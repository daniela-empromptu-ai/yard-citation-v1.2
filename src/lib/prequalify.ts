/**
 * Pre-qualification pipeline: narrow 100 discovered creators to 10 via content + AI scoring.
 *
 * Supports YouTube (transcripts), Medium (RSS articles), and Dev.to (API articles).
 *
 * Flow:
 * 1. Split creators by platform
 * 2. YouTube: resolve channels → latest video → transcript
 * 3. Medium/Dev.to: fetch recent articles via RSS/API
 * 4. AI Stage 1: Batch-score 100 (Haiku, 10 batches of 10)
 * 5. AI Stage 2: Rank top 20 → pick 10 (Sonnet)
 * 6. Persist results to DB
 */

import JSON5 from 'json5'
import { dbQuery, t, callAIApi } from '@/lib/db'
import { isDormant } from '@/lib/creator-guardrails'
import { isYouTubeConfigured } from '@/lib/anthropic'
import {
  resolveChannelId,
  getLatestVideo,
  getChannelVideos,
  rankVideosByRelevance,
  searchChannelVideos,
  buildTranscriptFromTimedText,
  CreatorTranscriptResult,
} from '@/lib/youtube'
import { fetchCreatorArticles, CreatorArticleResult } from '@/lib/ingest-articles'

// ─── Types ───

interface CampaignContext {
  brief: string
  topics: string[]
}

interface CreatorRow {
  creator_id: string
  creator_name: string
  cc_id: string // campaign_creators.id
  platform: string
  topics: string[]
  follower_count: number | null
  platform_url: string | null
  /** Videos found during discovery — skip video search, fetch these directly */
  anchorVideos?: { videoId: string; title: string; publishedAt: string }[]
}

interface Stage1Score {
  creator_id: string
  score: number
  reason: string
}

interface Stage2Selection {
  creator_id: string
  rank: number
  score: number
  rationale: string
  key_quote: string
}

interface Stage2Result {
  selected: Stage2Selection[]
  rejected: { creator_id: string; reason: string }[]
}

interface PrequalifyResult {
  total_discovered: number
  youtube_found: number
  transcripts_fetched: number
  articles_fetched: number
  selected_count: number
  selected_creators: Stage2Selection[]
}

// ─── 1. Fetch Creator Transcripts ───

export async function fetchCreatorTranscripts(
  creators: CreatorRow[],
  campaignTopics: string[] = []
): Promise<CreatorTranscriptResult[]> {
  const apiKey = process.env.YOUTUBE_API_KEY || ''
  const videosPerCreator = parseInt(process.env.VIDEOS_PER_CREATOR || '3', 10)
  const results: CreatorTranscriptResult[] = []
  let transcriptRequests = 0

  // Process sequentially to respect Supadata rate limits (free tier: 1 req/s)
  for (let i = 0; i < creators.length; i++) {
    const creator = creators[i]
    const base: CreatorTranscriptResult = {
      creatorId: creator.creator_id,
      creatorName: creator.creator_name,
      status: 'no_youtube',
      followerCount: creator.follower_count ?? undefined,
      topics: creator.topics,
    }

    if (!creator.platform_url) {
      console.log(`[transcript] ${creator.creator_name}: no YouTube URL, skipping`)
      results.push(base)
      continue
    }

    try {
      // Step 1: Resolve channel ID
      const resolution = await resolveChannelId(creator.platform_url, apiKey)
      if (!resolution.channelId) {
        console.log(`[transcript] ${creator.creator_name}: channel resolution failed — ${resolution.error || 'no channel ID'}  (url: ${creator.platform_url})`)
        results.push({ ...base, status: 'no_channel', error: resolution.error })
        continue
      }
      base.channelId = resolution.channelId

      // Fetch latest video date via RSS for dormancy check (free, ~1s)
      // Anchor videos may be old but topically relevant — not a signal of dormancy
      const latestRssVideo = await getLatestVideo(resolution.channelId)
      if (latestRssVideo) {
        base.latestPublishDate = latestRssVideo.publishedAt
      }

      // Step 2: Select videos for transcript fetching
      // Priority: anchor videos from discovery > per-channel search > RSS fallback
      let topVideos: { videoId: string; title: string; publishedAt: string; url: string }[] = []

      if (creator.anchorVideos && creator.anchorVideos.length > 0) {
        // Use anchor videos from discovery — already known to be relevant
        topVideos = creator.anchorVideos.slice(0, videosPerCreator).map(v => ({
          videoId: v.videoId,
          title: v.title,
          publishedAt: v.publishedAt,
          url: `https://www.youtube.com/watch?v=${v.videoId}`,
        }))
        console.log(`[transcript] ${creator.creator_name}: using ${topVideos.length} anchor videos from discovery`)
      } else {
        // No anchor videos — fall back to per-channel search, then RSS
        const sortedTopics = [...campaignTopics].sort((a, b) => a.length - b.length)
        const searchQuery = sortedTopics[0] || ''

        if (searchQuery && apiKey) {
          try {
            const channelResults = await searchChannelVideos(
              resolution.channelId, searchQuery, apiKey,
              { maxResults: videosPerCreator }
            )
            if (channelResults.length > 0) {
              topVideos = channelResults.map(r => ({
                videoId: r.videoId,
                title: r.title,
                publishedAt: r.publishedAt || new Date().toISOString(),
                url: `https://www.youtube.com/watch?v=${r.videoId}`,
              }))
              console.log(`[transcript] ${creator.creator_name}: per-channel search found ${topVideos.length} videos`)
            }
          } catch (e) {
            console.log(`[transcript] ${creator.creator_name}: channel search failed (${(e as Error).message})`)
          }
        }

        if (topVideos.length === 0) {
          const rssVideos = await getChannelVideos(resolution.channelId, 15)
          const ranked = campaignTopics.length > 0
            ? rankVideosByRelevance(rssVideos, campaignTopics)
            : rssVideos
          topVideos = ranked.slice(0, videosPerCreator)
          if (topVideos.length > 0) {
            console.log(`[transcript] ${creator.creator_name}: RSS fallback — ${topVideos.length} videos`)
          }
        }
      }

      if (topVideos.length === 0) {
        console.log(`[transcript] ${creator.creator_name}: no videos found for channel ${resolution.channelId}`)
        results.push({ ...base, status: 'no_video' })
        continue
      }

      console.log(`[transcript] ${creator.creator_name}: fetching transcripts for ${topVideos.length} videos`)

      base.video = topVideos[0]
      base.videos = topVideos

      // Step 3: Fetch transcripts for top N videos (0.5s delay between requests)
      const allSegments: { text: string; start: number; duration: number }[] = []
      const allFullTexts: string[] = []
      let transcriptLanguage = 'en'
      let anyTranscript = false

      for (const video of topVideos) {
        if (transcriptRequests > 0) await new Promise(r => setTimeout(r, 500))
        transcriptRequests++

        const transcript = await buildTranscriptFromTimedText(video.videoId)
        if (transcript) {
          anyTranscript = true
          allSegments.push(...transcript.segments)
          allFullTexts.push(transcript.fullText)
          transcriptLanguage = transcript.language
        } else {
          console.log(`[transcript] ${creator.creator_name}: no transcript for video ${video.videoId}`)
        }
      }

      if (!anyTranscript) {
        results.push({ ...base, status: 'no_transcript' })
        continue
      }

      // Merge transcripts into one
      const mergedTranscript = {
        videoId: topVideos[0].videoId,
        language: transcriptLanguage,
        segments: allSegments,
        fullText: allFullTexts.join('\n\n---\n\n'),
      }

      const totalWords = mergedTranscript.fullText.split(/\s+/).length
      console.log(`[transcript] ${creator.creator_name}: success — ${topVideos.length} videos, ${totalWords} words`)
      results.push({ ...base, status: 'success', transcript: mergedTranscript })
    } catch (e) {
      console.log(`[transcript] ${creator.creator_name}: error — ${(e as Error).message}`)
      results.push({ ...base, status: 'error', error: (e as Error).message })
    }

    if ((i + 1) % 10 === 0) {
      console.log(`[prequalify] Transcript progress: ${i + 1}/${creators.length}`)
    }
  }
  console.log(`[prequalify] Transcript progress: ${creators.length}/${creators.length} done`)

  return results
}

// ─── 2. AI Narrowing ───

async function setupPrompt(name: string, variables: string[], text: string) {
  await callAIApi('/setup_ai_prompt', {
    prompt_name: name,
    input_variables: variables,
    prompt_text: text,
  })
}

async function applyPrompt(name: string, inputData: Record<string, string>, returnType: string) {
  const result = await callAIApi('/apply_prompt_to_data', {
    prompt_name: name,
    input_data: { ...inputData, return_type: returnType },
  }) as { value: unknown }
  return result.value
}

export async function aiNarrowCreators(
  transcriptResults: CreatorTranscriptResult[],
  campaignContext: CampaignContext
): Promise<{ selected: Stage2Selection[]; allStage1Scores: Stage1Score[] }> {
  // ── Stage 1: Batch score ──
  const allStage1Scores: Stage1Score[] = []

  await setupPrompt(
    'prequalify_stage1',
    ['campaign_brief', 'campaign_topics', 'creators_block'],
    `You are screening content creators for a sponsored content campaign. Creators may be from YouTube, Medium, Dev.to, or other platforms.

CAMPAIGN: {campaign_brief}
TOPICS: {campaign_topics}

CREATORS (score each 0-100 on campaign fit):
{creators_block}

EXCLUSION RULES — score 0 for any of these:
- Company/vendor-owned channels — cloud providers, DevOps vendors, testing/QA tool companies (BrowserStack, Applitools, TestRail, mabl, etc.), developer platforms (Vercel, Supabase). If it's a company selling a product, score 0.
- Training/certification companies or bootcamp channels
- Creators who haven't published in 2+ years (dormant)
- Channels with primarily AI-generated or synthetic content
- Auto-dubbed/auto-translated content
- Lifestyle, vlog, or non-technical content creators
ONLY score independent creators — individuals or small creator-led channels, not companies.

QUALITY SIGNALS — use these to differentiate:
- Score HIGHER (60+) for channels where a senior developer or CTO would learn something new — production war stories, architecture deep-dives, real-world tooling reviews, conference talks
- Score LOWER for tutorial mills that only teach beginners step-by-step instructions ("How to Install X", "X Tutorial for Beginners") — cap these at 15 even if topic-relevant
- Independent creators sharing real-world experience and production insights — score 60+
- Creators who demonstrate hands-on expertise (debugging live, showing real codebases, sharing failures) — score higher

Scoring rules:
- Creators WITH content (transcripts or articles): score based on content depth, originality, and whether a senior engineer would subscribe
- Creators WITHOUT content: score based on topic match and follower count only, cap score at 20

Return ONLY a JSON array, no other text:
[{"creator_id":"...","score":85,"reason":"one sentence"}]`
  )

  // Build name→ID lookup so we can recover from garbled UUIDs in AI responses
  const nameToId = new Map<string, string>()
  for (const cr of transcriptResults) {
    nameToId.set(cr.creatorName.toLowerCase(), cr.creatorId)
  }

  for (let i = 0; i < transcriptResults.length; i += 10) {
    const batch = transcriptResults.slice(i, i + 10)
    const creatorsBlock = batch.map(cr => {
      const topicsStr = (cr.topics || []).join(', ')
      const followersStr = cr.followerCount ? `${cr.followerCount} followers` : 'unknown followers'

      if (cr.status === 'success' && cr.transcript) {
        const excerpt = cr.transcript.fullText.slice(0, 2000)
        const videos = cr.videos || (cr.video ? [cr.video] : [])
        const videoLines = videos.map(v => `  - "${v.title}" (${v.publishedAt?.slice(0, 10) || 'unknown date'})`).join('\n')
        return `--- ${cr.creatorName} (id: ${cr.creatorId}) | ${followersStr} | Topics: ${topicsStr} ---\nVideos analyzed:\n${videoLines}\nTranscript excerpt: ${excerpt}\n---`
      } else {
        return `--- ${cr.creatorName} (id: ${cr.creatorId}) | ${followersStr} | Topics: ${topicsStr} ---\nNo transcript available (${cr.status})\n---`
      }
    }).join('\n\n')

    try {
      const raw = await applyPrompt('prequalify_stage1', {
        campaign_brief: campaignContext.brief,
        campaign_topics: campaignContext.topics.join(', '),
        creators_block: creatorsBlock,
      }, 'raw_text') as string

      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const scores = parseJsonFromResponse<Stage1Score[]>(cleaned)
      if (scores) {
        // Fix garbled IDs: if a returned creator_id doesn't match any known creator,
        // try to recover by matching the response position to batch order
        for (const score of scores) {
          if (!nameToId.has(score.creator_id) && !transcriptResults.some(t => t.creatorId === score.creator_id)) {
            // ID is garbled — try positional match within batch
            const idx = scores.indexOf(score)
            if (idx < batch.length) {
              const correctedId = batch[idx].creatorId
              console.log(`[prequalify] Fixed garbled ID: "${score.creator_id}" → ${correctedId} (${batch[idx].creatorName})`)
              score.creator_id = correctedId
            }
          }
        }
        allStage1Scores.push(...scores)
      }
    } catch (e) {
      console.error(`[prequalify] Stage 1 batch ${Math.floor(i / 10) + 1} failed:`, e)
      for (const cr of batch) {
        allStage1Scores.push({
          creator_id: cr.creatorId,
          score: cr.status === 'success' ? 30 : 5,
          reason: 'AI scoring failed, fallback score',
        })
      }
    }

    console.log(`[prequalify] Stage 1 batch ${Math.floor(i / 10) + 1}/${Math.ceil(transcriptResults.length / 10)} scored`)
  }

  // ── Stage 2: Rank top 20 → pick 10 ──
  allStage1Scores.sort((a, b) => b.score - a.score)
  const top20Ids = new Set(allStage1Scores.slice(0, 20).map(s => s.creator_id))
  const top20Results = transcriptResults.filter(r => top20Ids.has(r.creatorId))

  const candidatesBlock = top20Results.map(cr => {
    const stage1 = allStage1Scores.find(s => s.creator_id === cr.creatorId)
    const followersStr = cr.followerCount ? `${cr.followerCount} followers` : 'unknown followers'
    const topicsStr = (cr.topics || []).join(', ')
    const transcriptText = cr.transcript?.fullText || '(no transcript)'

    return `--- ${cr.creatorName} (id: ${cr.creatorId}) | ${followersStr} | Topics: ${topicsStr} | Stage 1 score: ${stage1?.score ?? 0} ---
${transcriptText}
---`
  }).join('\n\n')

  try {
    await setupPrompt(
      'prequalify_stage2',
      ['campaign_brief', 'campaign_topics', 'candidates_block', 'candidate_count'],
      `You are a creator partnerships strategist selecting the TOP 10 creators for outreach.

CAMPAIGN: {campaign_brief}
TOPICS: {campaign_topics}

CANDIDATES ({candidate_count}, with content samples):
{candidates_block}

Select exactly 10 (or fewer if less than 10 candidates have useful content). Return ONLY JSON, no other text:
{
  "selected": [{"creator_id":"...","rank":1,"score":95,"rationale":"...","key_quote":"..."}],
  "rejected": [{"creator_id":"...","reason":"..."}]
}`
    )

    const raw = await applyPrompt('prequalify_stage2', {
      campaign_brief: campaignContext.brief,
      campaign_topics: campaignContext.topics.join(', '),
      candidates_block: candidatesBlock,
      candidate_count: String(top20Results.length),
    }, 'raw_text') as string

    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const result = parseJsonFromResponse<Stage2Result>(cleaned)
    if (result?.selected && result.selected.length > 0) {
      // Fix garbled IDs from Stage 2
      for (const sel of result.selected) {
        if (!transcriptResults.some(t => t.creatorId === sel.creator_id)) {
          // Try name-based recovery from the candidates
          const byName = top20Results.find(r =>
            sel.creator_id.toLowerCase().includes(r.creatorName.toLowerCase()) ||
            r.creatorName.toLowerCase().includes(sel.creator_id.toLowerCase())
          )
          if (byName) {
            console.log(`[prequalify] Stage 2 fixed garbled ID: "${sel.creator_id}" → ${byName.creatorId} (${byName.creatorName})`)
            sel.creator_id = byName.creatorId
          }
        }
      }
      console.log(`[prequalify] Stage 2 selected ${result.selected.length} creators`)
      return { selected: result.selected, allStage1Scores }
    }
  } catch (e) {
    console.error('[prequalify] Stage 2 failed:', e)
  }

  // Fallback: use Stage 1 top 10
  console.log('[prequalify] Stage 2 failed, falling back to Stage 1 top 10')
  const fallbackSelected = allStage1Scores.slice(0, 10).map((s, i) => ({
    creator_id: s.creator_id,
    rank: i + 1,
    score: s.score,
    rationale: s.reason,
    key_quote: '',
  }))
  return { selected: fallbackSelected, allStage1Scores }
}

/**
 * Fallback selection when no Anthropic key: pick top 10 by topic match + followers.
 */
export function fallbackSelectTop10(
  transcriptResults: CreatorTranscriptResult[],
  campaignTopics: string[]
): Stage2Selection[] {
  const scored = transcriptResults.map(cr => {
    let score = 0
    const topicsLower = (cr.topics || []).map(t => t.toLowerCase())
    const campaignLower = campaignTopics.map(t => t.toLowerCase())

    // Topic match score
    for (const ct of campaignLower) {
      for (const creatorTopic of topicsLower) {
        if (creatorTopic.includes(ct) || ct.includes(creatorTopic)) {
          score += 15
          break
        }
      }
    }

    // Follower bonus
    if (cr.followerCount) {
      score += Math.min(20, Math.floor(cr.followerCount / 10000))
    }

    // Transcript bonus
    if (cr.status === 'success') score += 10

    return { ...cr, score }
  })

  scored.sort((a, b) => b.score - a.score)

  return scored.slice(0, 10).map((cr, i) => ({
    creator_id: cr.creatorId,
    rank: i + 1,
    score: cr.score,
    rationale: `Selected by topic match (${(cr.topics || []).join(', ')}) and follower count`,
    key_quote: '',
  }))
}

// ─── 3. Persist Results ───

export async function persistResults(
  selected: Stage2Selection[],
  allTranscripts: CreatorTranscriptResult[],
  campaignId: string,
  userId: string,
  articleResults?: CreatorArticleResult[]
): Promise<void> {
  const now = new Date().toISOString()

  // Build lookup for article results
  const articleMap = new Map<string, CreatorArticleResult>()
  for (const ar of articleResults || []) {
    articleMap.set(ar.creatorId, ar)
  }

  // Build name→transcript lookup for fallback when AI garbles UUIDs
  const nameToTranscript = new Map<string, CreatorTranscriptResult>()
  for (const tr of allTranscripts) {
    nameToTranscript.set(tr.creatorName.toLowerCase(), tr)
  }
  const nameToArticle = new Map<string, CreatorArticleResult>()
  for (const ar of articleResults || []) {
    nameToArticle.set(ar.creatorName.toLowerCase(), ar)
  }

  // ── Resolve selected creator IDs (AI may garble UUIDs) ──
  for (const sel of selected) {
    if (!allTranscripts.some(tr => tr.creatorId === sel.creator_id)) {
      for (const candidate of allTranscripts) {
        if (sel.creator_id.includes(candidate.creatorName.toLowerCase()) ||
            candidate.creatorName.toLowerCase().includes(sel.creator_id.toLowerCase())) {
          console.log(`[prequalify] persistResults: matched "${sel.creator_id}" → ${candidate.creatorId} (${candidate.creatorName}) by name`)
          sel.creator_id = candidate.creatorId
          break
        }
      }
    }
  }

  // ── Batch insert all content items ──
  // Columns: creator_id, campaign_id, platform, content_type, title, url, published_at,
  //          fetched_at, language, raw_text, word_count, metadata_json,
  //          ingestion_method, ingestion_status, created_at, updated_at
  const contentRows: unknown[][] = []
  const ingestedIds: string[] = []
  const noContentUpdates: { creatorId: string; note: string }[] = []

  for (const sel of selected) {
    const tr = allTranscripts.find(tr => tr.creatorId === sel.creator_id)
    if (!tr) {
      console.log(`[prequalify] persistResults: no match for selected creator_id "${sel.creator_id}" — skipping`)
      continue
    }

    const ar = articleMap.get(sel.creator_id) || nameToArticle.get(tr.creatorName.toLowerCase())

    if (ar && ar.status === 'success' && ar.articles.length > 0) {
      // Article-based creator (Medium/Dev.to)
      const ingestionMethod = ar.platform === 'medium' ? 'medium_rss' : 'devto_api'
      const contentType = ar.platform === 'medium' ? 'medium_article' : 'devto_article'
      for (const article of ar.articles) {
        contentRows.push([
          ar.creatorId, campaignId, ar.platform, contentType,
          article.title, article.url, article.publishedAt,
          now, null, // fetched_at=now (handled below), language=null
          article.text, article.wordCount,
          JSON.stringify({ tags: article.tags, prequalify_rank: sel.rank, prequalify_score: sel.score, prequalify_rationale: sel.rationale, key_quote: sel.key_quote }),
          ingestionMethod, 'complete', now, now,
        ])
      }
      ingestedIds.push(ar.creatorId)
    } else if (tr.transcript && tr.video) {
      // YouTube creator
      contentRows.push([
        tr.creatorId, campaignId, 'youtube', 'youtube_video',
        tr.video.title, tr.video.url, tr.video.publishedAt,
        now, tr.transcript.language,
        tr.transcript.fullText, tr.transcript.fullText.split(/\s+/).length,
        JSON.stringify({
          video_id: tr.video.videoId,
          all_video_ids: (tr.videos || [tr.video]).map(v => v.videoId),
          all_video_titles: (tr.videos || [tr.video]).map(v => v.title),
          prequalify_rank: sel.rank, prequalify_score: sel.score,
          prequalify_rationale: sel.rationale, key_quote: sel.key_quote,
          transcript_segments: tr.transcript.segments.map(s => ({ t: s.start, d: s.duration, txt: s.text })),
        }),
        'prequalification', 'complete', now, now,
      ])
      ingestedIds.push(tr.creatorId)
    } else {
      console.log(`[prequalify] ${tr.creatorName}: selected but no content (status: ${tr.status}), keeping as discovered`)
      noContentUpdates.push({ creatorId: tr.creatorId, note: `Selected by AI but no content available (${tr.status})` })
    }
  }

  // One batch INSERT for all content items
  if (contentRows.length > 0) {
    // Build multi-row INSERT manually to include fetched_at=now() inline
    const valueClauses: string[] = []
    const params: unknown[] = []
    let paramIdx = 1
    for (const row of contentRows) {
      // fetched_at is at index 7 — replace with now()
      const colParams = row.map((v, i) => i === 7 ? 'now()' : `$${paramIdx++}`)
      valueClauses.push(`(${colParams.join(', ')})`)
      params.push(...row.filter((_, i) => i !== 7))
    }
    await dbQuery(
      `INSERT INTO ${t('content_items')} (creator_id, campaign_id, platform, content_type, title, url, published_at, fetched_at, language, raw_text, word_count, metadata_json, ingestion_method, ingestion_status, created_at, updated_at)
       VALUES ${valueClauses.join(', ')} ON CONFLICT DO NOTHING`,
      params
    )
  }

  // One UPDATE for all ingested creators
  if (ingestedIds.length > 0) {
    const placeholders = ingestedIds.map((_, i) => `$${i + 3}`).join(', ')
    await dbQuery(
      `UPDATE ${t('campaign_creators')} SET pipeline_stage='ingested', updated_at=$2
       WHERE campaign_id=$1 AND creator_id IN (${placeholders})`,
      [campaignId, now, ...ingestedIds]
    )
  }

  // Individual updates for no-content selected creators (rare, at most a few)
  for (const { creatorId, note } of noContentUpdates) {
    await dbQuery(
      `UPDATE ${t('campaign_creators')} SET notes=$2, updated_at=$3 WHERE campaign_id=$1 AND creator_id=$4`,
      [campaignId, note, now, creatorId]
    )
  }

  // Rebuild selectedIds after potential ID corrections
  const selectedIds = new Set(selected.map(s => s.creator_id))

  // One UPDATE for all excluded creators
  const excluded = allTranscripts.filter(tr => !selectedIds.has(tr.creatorId))
  if (excluded.length > 0) {
    const excludedIds = excluded.map(ex => ex.creatorId)
    const placeholders = excludedIds.map((_, i) => `$${i + 3}`).join(', ')
    await dbQuery(
      `UPDATE ${t('campaign_creators')} SET pipeline_stage='excluded', notes='Pre-qualification: not selected', updated_at=$2
       WHERE campaign_id=$1 AND creator_id IN (${placeholders})`,
      [campaignId, now, ...excludedIds]
    )
    // Mark pipeline-excluded creators as excluded globally — but only if they have no
    // existing relationship (relationship_status = 'none'), so we don't accidentally
    // hide a creator someone has already cultivated just because they missed one campaign.
    const excPlaceholders = excludedIds.map((_, i) => `$${i + 2}`).join(', ')
    await dbQuery(
      `UPDATE ${t('creators')} SET excluded = true, exclusion_reason = 'Not selected during pre-qualification', updated_at = $1
       WHERE id IN (${excPlaceholders})
         AND (relationship_status IS NULL OR relationship_status = 'none')
         AND excluded = false`,
      [now, ...excludedIds]
    )
  }

  // Log activity
  const articlesFetched = (articleResults || []).filter(a => a.status === 'success').length
  await dbQuery(
    `INSERT INTO ${t('activity_log')} (campaign_id, actor_user_id, event_type, event_data_json, created_at)
     VALUES ($1, $2, 'prequalification_completed', $3::jsonb, now())`,
    [
      campaignId,
      userId,
      JSON.stringify({
        total: allTranscripts.length,
        selected: selected.length,
        excluded: excluded.length,
        transcripts_fetched: allTranscripts.filter(t => t.status === 'success').length,
        articles_fetched: articlesFetched,
      }),
    ]
  )
}

// ─── Full Pipeline ───

export async function runPrequalifyPipeline(
  campaignId: string,
  userId: string,
  campaignContext: CampaignContext
): Promise<PrequalifyResult> {
  // Load discovered creators (V2: creator IS the platform presence)
  const creatorsRes = await dbQuery<{
    cc_id: string
    creator_id: string
    name: string
    platform: string
    url: string | null
    subscriber_count: number | null
    notes: string | null
  }>(
    `SELECT
       cc.id AS cc_id,
       cc.creator_id,
       c.name,
       c.platform,
       c.url,
       c.subscriber_count,
       cc.notes
     FROM ${t('campaign_creators')} cc
     JOIN ${t('creators')} c ON c.id = cc.creator_id
     WHERE cc.campaign_id = $1 AND cc.pipeline_stage = 'discovered'
     ORDER BY (
       SELECT COUNT(*) FROM creator_categories cc2
       JOIN categories cat ON cat.id = cc2.category_id
       JOIN campaign_topics ct ON ct.topic ILIKE '%' || cat.name || '%' OR cat.name ILIKE '%' || ct.topic || '%'
       WHERE cc2.creator_id = c.id AND ct.campaign_id = $1
     ) DESC, c.subscriber_count DESC NULLS LAST
     LIMIT $2`,
    [campaignId, parseInt(process.env.PREQUALIFY_LIMIT || '100', 10)]
  )

  if (!creatorsRes.success || creatorsRes.data.length === 0) {
    throw new Error('No discovered creators found for this campaign')
  }

  // Load category names for each creator as "topics" for AI context
  const creatorIds = creatorsRes.data.map(r => r.creator_id)
  const catRes = await dbQuery<{ creator_id: string; category_name: string }>(
    `SELECT cc2.creator_id, cat.name as category_name
     FROM ${t('creator_categories')} cc2
     JOIN ${t('categories')} cat ON cat.id = cc2.category_id
     WHERE cc2.creator_id = ANY($1::uuid[])`,
    [creatorIds]
  )
  const creatorTopics = new Map<string, string[]>()
  for (const row of catRes.data) {
    const arr = creatorTopics.get(row.creator_id) || []
    arr.push(row.category_name)
    creatorTopics.set(row.creator_id, arr)
  }

  const ARTICLE_PLATFORMS = new Set(['medium', 'devto'])

  const creators: CreatorRow[] = creatorsRes.data.map(r => {
    // Parse anchor videos from notes JSON if present
    let anchorVideos: { videoId: string; title: string; publishedAt: string }[] | undefined
    if (r.notes) {
      try {
        const parsed = JSON.parse(r.notes)
        if (parsed.anchorVideos) anchorVideos = parsed.anchorVideos
      } catch { /* notes is plain text, not JSON */ }
    }

    return {
      creator_id: r.creator_id,
      creator_name: r.name,
      cc_id: r.cc_id,
      platform: r.platform,
      topics: creatorTopics.get(r.creator_id) || [],
      follower_count: r.subscriber_count,
      platform_url: (r.platform === 'youtube' || ARTICLE_PLATFORMS.has(r.platform)) ? r.url : null,
      anchorVideos,
    }
  })

  // Split by platform type
  const youtubeCreators = creators.filter(c => c.platform === 'youtube')
  const articleCreators = creators.filter(c => ARTICLE_PLATFORMS.has(c.platform))
  const otherCreators = creators.filter(c => c.platform !== 'youtube' && !ARTICLE_PLATFORMS.has(c.platform))

  console.log(`[prequalify] Starting pipeline for ${creators.length} creators (${youtubeCreators.length} YouTube, ${articleCreators.length} article-based, ${otherCreators.length} other)`)

  // ── Step 1: Fetch YouTube transcripts ──
  let youtubeResults: CreatorTranscriptResult[] = []
  if (youtubeCreators.length > 0 && isYouTubeConfigured()) {
    youtubeResults = await fetchCreatorTranscripts(youtubeCreators, campaignContext.topics)
  } else if (youtubeCreators.length > 0) {
    console.log('[prequalify] YouTube API key not configured, skipping YouTube creators')
    youtubeResults = youtubeCreators.map(c => ({
      creatorId: c.creator_id,
      creatorName: c.creator_name,
      status: 'no_youtube' as const,
      followerCount: c.follower_count ?? undefined,
      topics: c.topics,
    }))
  }

  // ── Step 2: Fetch Medium/Dev.to articles ──
  let articleResults: CreatorArticleResult[] = []
  if (articleCreators.length > 0) {
    articleResults = await fetchCreatorArticles(
      articleCreators.map(c => ({
        creator_id: c.creator_id,
        creator_name: c.creator_name,
        platform: c.platform,
        platform_url: c.platform_url,
        follower_count: c.follower_count,
        topics: c.topics,
      }))
    )
  }

  // ── Step 3: Convert article results → CreatorTranscriptResult for unified AI scoring ──
  const articleAsTranscript: CreatorTranscriptResult[] = articleResults.map(ar => ({
    creatorId: ar.creatorId,
    creatorName: ar.creatorName,
    status: ar.status === 'success' ? 'success' as const : 'no_transcript' as const,
    followerCount: ar.followerCount,
    topics: ar.topics,
    // Reuse transcript field to hold article text for AI scoring
    transcript: ar.status === 'success' ? {
      videoId: '', // not applicable
      language: 'en',
      segments: [],
      fullText: ar.combinedText,
    } : undefined,
    // Use first article as "video" equivalent for display
    video: ar.articles.length > 0 ? {
      videoId: '',
      title: ar.articles[0].title,
      publishedAt: ar.articles[0].publishedAt,
      url: ar.articles[0].url,
    } : undefined,
  }))

  // Other platform creators: no content available
  const otherResults: CreatorTranscriptResult[] = otherCreators.map(c => ({
    creatorId: c.creator_id,
    creatorName: c.creator_name,
    status: 'no_youtube' as const,
    followerCount: c.follower_count ?? undefined,
    topics: c.topics,
  }))

  // Merge all results
  const allResultsRaw: CreatorTranscriptResult[] = [...youtubeResults, ...articleAsTranscript, ...otherResults]

  // ── Dormancy check: exclude creators whose most recent content is 2+ years old ──
  // Use latestPublishDate (from RSS) if available — anchor video dates can be old but topically relevant
  const allResults: CreatorTranscriptResult[] = []
  const dormantIds: string[] = []
  for (const cr of allResultsRaw) {
    const publishedAt = cr.latestPublishDate || cr.video?.publishedAt || null
    if (publishedAt && isDormant(publishedAt)) {
      dormantIds.push(cr.creatorId)
      console.log(`[prequalify] ${cr.creatorName}: excluded (dormant — last RSS video ${publishedAt.slice(0, 10)})`)
      continue
    }
    allResults.push(cr)
  }
  if (dormantIds.length > 0) {
    const now = new Date().toISOString()
    const idPlaceholders = dormantIds.map((_, i) => `$${i + 1}`).join(', ')
    await dbQuery(
      `UPDATE ${t('creators')} SET excluded = true, exclusion_reason = $${dormantIds.length + 1}, updated_at = $${dormantIds.length + 2} WHERE id IN (${idPlaceholders})`,
      [...dormantIds, 'Dormant — no content in 2+ years', now]
    )
    await dbQuery(
      `UPDATE ${t('campaign_creators')} SET pipeline_stage = 'excluded', notes = $2, updated_at = $3
       WHERE campaign_id = $1 AND creator_id IN (${dormantIds.map((_, i) => `$${i + 4}`).join(', ')})`,
      [campaignId, 'Excluded: dormant creator (no content in 2+ years)', now, ...dormantIds]
    )
  }

  const youtubeFound = youtubeResults.filter(r => r.status !== 'no_youtube').length
  const transcriptsFetched = youtubeResults.filter(r => r.status === 'success').length
  const articlesFetched = articleResults.filter(r => r.status === 'success').length

  console.log(`[prequalify] YouTube found: ${youtubeFound}, Transcripts: ${transcriptsFetched}, Articles: ${articlesFetched}`)

  if (allResults.length === 0) {
    throw new Error('No creators to score')
  }

  // ── Step 4-5: AI scoring via builder API ──
  let selected: Stage2Selection[]

  try {
    const aiResult = await aiNarrowCreators(allResults, campaignContext)
    selected = aiResult.selected
  } catch (e) {
    console.error('[prequalify] AI scoring failed, using fallback:', e)
    selected = fallbackSelectTop10(allResults, campaignContext.topics)
  }

  // ── Step 6-7: Persist ──
  await persistResults(selected, allResults, campaignId, userId, articleResults)

  console.log(`[prequalify] Pipeline complete. Selected ${selected.length} creators.`)

  return {
    total_discovered: creators.length,
    youtube_found: youtubeFound,
    transcripts_fetched: transcriptsFetched,
    articles_fetched: articlesFetched,
    selected_count: selected.length,
    selected_creators: selected,
  }
}

// ─── Helpers ───

function parseJsonFromResponse<T>(text: string): T | null {
  // Layer 1: strict JSON
  try { return JSON.parse(text) as T } catch { /* continue */ }

  // Layer 2: JSON5 (handles trailing commas, single quotes, unescaped chars, etc.)
  try { return JSON5.parse(text) as T } catch { /* continue */ }

  // Layer 3: extract from markdown code block
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (jsonMatch) {
    try { return JSON5.parse(jsonMatch[1].trim()) as T } catch { /* continue */ }
  }

  // Layer 4: extract JSON object/array from surrounding text
  const objectMatch = text.match(/\{[\s\S]*\}/)
  if (objectMatch) {
    try { return JSON5.parse(objectMatch[0]) as T } catch { /* continue */ }
  }
  const arrayMatch = text.match(/\[[\s\S]*\]/)
  if (arrayMatch) {
    try { return JSON5.parse(arrayMatch[0]) as T } catch { /* continue */ }
  }

  console.error('[prequalify] Failed to parse AI JSON. First 200 chars:', text.slice(0, 200))
  return null
}
