/**
 * Pre-qualification pipeline: narrow 100 discovered creators to 10 via YouTube transcripts + AI scoring.
 *
 * Flow:
 * 1. Resolve YouTube channel IDs
 * 2. Get latest video per channel (RSS — free)
 * 3. Fetch transcript per video (TimedText — free)
 * 4. AI Stage 1: Batch-score 100 (Haiku, 10 batches of 10)
 * 5. AI Stage 2: Rank top 20 → pick 10 (Sonnet)
 * 6. Persist results to DB
 */

import { dbQuery, t, callAIApi } from '@/lib/db'
import { isYouTubeConfigured } from '@/lib/anthropic'
import {
  resolveChannelId,
  getLatestVideo,
  buildTranscriptFromTimedText,
  CreatorTranscriptResult,
} from '@/lib/youtube'

// ─── Types ───

interface CampaignContext {
  brief: string
  topics: string[]
}

interface CreatorRow {
  creator_id: string
  creator_name: string
  cc_id: string // campaign_creators.id
  topics: string[]
  follower_count: number | null
  platform_url: string | null
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
  selected_count: number
  selected_creators: Stage2Selection[]
}

// ─── 1. Fetch Creator Transcripts ───

export async function fetchCreatorTranscripts(
  creators: CreatorRow[]
): Promise<CreatorTranscriptResult[]> {
  const apiKey = process.env.YOUTUBE_API_KEY || ''
  const results: CreatorTranscriptResult[] = []

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
      results.push(base)
      continue
    }

    try {
      // Step 1: Resolve channel ID
      const resolution = await resolveChannelId(creator.platform_url, apiKey)
      if (!resolution.channelId) {
        results.push({ ...base, status: 'no_channel', error: resolution.error })
        continue
      }
      base.channelId = resolution.channelId

      // Step 2: Get latest video via RSS
      const video = await getLatestVideo(resolution.channelId)
      if (!video) {
        results.push({ ...base, status: 'no_video' })
        continue
      }
      base.video = video

      // Step 3: Fetch transcript (delay between requests for rate limit)
      if (i > 0) await new Promise(r => setTimeout(r, 1200))
      const transcript = await buildTranscriptFromTimedText(video.videoId)
      if (!transcript) {
        results.push({ ...base, status: 'no_transcript' })
        continue
      }

      results.push({ ...base, status: 'success', transcript })
    } catch (e) {
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
    `You are screening YouTube creators for a sponsored content campaign.

CAMPAIGN: {campaign_brief}
TOPICS: {campaign_topics}

CREATORS (score each 0-100 on campaign fit):
{creators_block}

Scoring rules:
- Creators WITH transcripts: score based on content relevance, topic alignment, and quality signals
- Creators WITHOUT transcripts: score based on topic match and follower count only, cap score at 20

Return ONLY a JSON array, no other text:
[{"creator_id":"...","score":85,"reason":"one sentence"}]`
  )

  for (let i = 0; i < transcriptResults.length; i += 10) {
    const batch = transcriptResults.slice(i, i + 10)
    const creatorsBlock = batch.map(cr => {
      const topicsStr = (cr.topics || []).join(', ')
      const followersStr = cr.followerCount ? `${cr.followerCount} followers` : 'unknown followers'

      if (cr.status === 'success' && cr.transcript) {
        const excerpt = cr.transcript.fullText.slice(0, 2000)
        const videoTitle = cr.video?.title || 'Unknown'
        const videoDate = cr.video?.publishedAt?.slice(0, 10) || 'unknown date'
        return `--- ${cr.creatorName} (id: ${cr.creatorId}) | ${followersStr} | Topics: ${topicsStr} ---\nVideo: "${videoTitle}" (${videoDate})\nTranscript excerpt: ${excerpt}\n---`
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

CANDIDATES ({candidate_count}, with transcripts):
{candidates_block}

Select exactly 10 (or fewer if less than 10 candidates have useful transcripts). Return ONLY JSON, no other text:
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
  userId: string
): Promise<void> {
  const now = new Date().toISOString()
  const selectedIds = new Set(selected.map(s => s.creator_id))

  // Selected creators: insert transcript + advance pipeline
  for (const sel of selected) {
    const tr = allTranscripts.find(t => t.creatorId === sel.creator_id)
    if (!tr) continue

    // Insert transcript as content_item if we have one
    if (tr.transcript && tr.video) {
      await dbQuery(
        `INSERT INTO ${t('content_items')} (creator_id, campaign_id, platform, content_type, title, url, published_at, fetched_at, language, raw_text, word_count, metadata_json, ingestion_method, ingestion_status, created_at, updated_at)
         VALUES ($1, $2, 'youtube', 'youtube_video', $3, $4, $5, now(), $6, $7, $8, $9::jsonb, 'prequalification', 'complete', $10, $10)
         ON CONFLICT DO NOTHING`,
        [
          tr.creatorId,
          campaignId,
          tr.video.title,
          tr.video.url,
          tr.video.publishedAt,
          tr.transcript.language,
          tr.transcript.fullText,
          tr.transcript.fullText.split(/\s+/).length,
          JSON.stringify({
            video_id: tr.video.videoId,
            prequalify_rank: sel.rank,
            prequalify_score: sel.score,
            prequalify_rationale: sel.rationale,
            key_quote: sel.key_quote,
          }),
          now,
        ]
      )
    }

    // Advance campaign_creators to ingested
    await dbQuery(
      `UPDATE ${t('campaign_creators')} SET pipeline_stage='ingested', ingestion_status='complete', updated_at=$2
       WHERE campaign_id=$1 AND creator_id=$3`,
      [campaignId, now, tr.creatorId]
    )
  }

  // Excluded creators: mark as excluded
  const excluded = allTranscripts.filter(tr => !selectedIds.has(tr.creatorId))
  for (const ex of excluded) {
    const stage1Reason = `Pre-qualification: not selected (status: ${ex.status})`
    await dbQuery(
      `UPDATE ${t('campaign_creators')} SET pipeline_stage='excluded', ingestion_error=$2, updated_at=$3
       WHERE campaign_id=$1 AND creator_id=$4`,
      [campaignId, stage1Reason, now, ex.creatorId]
    )
  }

  // Log activity
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
  // Load discovered creators with their YouTube platform accounts
  const creatorsRes = await dbQuery<{
    cc_id: string
    creator_id: string
    display_name: string
    topics: string[]
    platform_url: string | null
    follower_count: number | null
  }>(
    `SELECT
       cc.id AS cc_id,
       cc.creator_id,
       c.display_name,
       c.topics,
       cpa.url AS platform_url,
       cpa.follower_count
     FROM ${t('campaign_creators')} cc
     JOIN ${t('creators')} c ON c.id = cc.creator_id
     LEFT JOIN ${t('creator_platform_accounts')} cpa ON cpa.creator_id = c.id AND cpa.platform = 'youtube'
     WHERE cc.campaign_id = $1 AND cc.pipeline_stage = 'discovered'
     ORDER BY cpa.follower_count DESC NULLS LAST
     LIMIT $2`,
    [campaignId, parseInt(process.env.PREQUALIFY_LIMIT || '100', 10)]
  )

  if (!creatorsRes.success || creatorsRes.data.length === 0) {
    throw new Error('No discovered creators found for this campaign')
  }

  const creators: CreatorRow[] = creatorsRes.data.map(r => ({
    creator_id: r.creator_id,
    creator_name: r.display_name,
    cc_id: r.cc_id,
    topics: Array.isArray(r.topics) ? r.topics : [],
    follower_count: r.follower_count,
    platform_url: r.platform_url,
  }))

  console.log(`[prequalify] Starting pipeline for ${creators.length} creators`)

  // Step 1-3: Fetch transcripts
  if (!isYouTubeConfigured()) {
    throw new Error('YouTube API key not configured. Set YOUTUBE_API_KEY in .env.local')
  }

  const transcriptResults = await fetchCreatorTranscripts(creators)

  const youtubeFound = transcriptResults.filter(r => r.status !== 'no_youtube').length
  const transcriptsFetched = transcriptResults.filter(r => r.status === 'success').length

  console.log(`[prequalify] YouTube found: ${youtubeFound}, Transcripts: ${transcriptsFetched}`)

  // Step 4-5: AI scoring via builder API
  let selected: Stage2Selection[]

  try {
    const aiResult = await aiNarrowCreators(transcriptResults, campaignContext)
    selected = aiResult.selected
  } catch (e) {
    console.error('[prequalify] AI scoring failed, using fallback:', e)
    selected = fallbackSelectTop10(transcriptResults, campaignContext.topics)
  }

  // Step 6-7: Persist
  await persistResults(selected, transcriptResults, campaignId, userId)

  console.log(`[prequalify] Pipeline complete. Selected ${selected.length} creators.`)

  return {
    total_discovered: creators.length,
    youtube_found: youtubeFound,
    transcripts_fetched: transcriptsFetched,
    selected_count: selected.length,
    selected_creators: selected,
  }
}

// ─── Helpers ───

function parseJsonFromResponse<T>(text: string): T | null {
  // Try direct parse
  try {
    return JSON.parse(text) as T
  } catch {
    // Try extracting JSON from markdown code block
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1].trim()) as T
      } catch {
        return null
      }
    }
    // Try finding JSON object/array in text
    const bracketMatch = text.match(/[\[{][\s\S]*[\]}]/)
    if (bracketMatch) {
      try {
        return JSON.parse(bracketMatch[0]) as T
      } catch {
        return null
      }
    }
    return null
  }
}
