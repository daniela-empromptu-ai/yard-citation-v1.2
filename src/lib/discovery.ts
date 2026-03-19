/**
 * V2 Discovery: DB matching + YouTube API search + LLM look-alike suggestions.
 *
 * Phase 0: Gumshoe citation extraction (if URL + API key available)
 * Phase A: Match existing creators by category overlap with campaign topics.
 * Phase B: YouTube Search API — find real channels by campaign search terms.
 * Phase C: LLM suggests new creators → verify → dedup → insert → link.
 */

import { dbQuery, t, callAIApi } from '@/lib/db'
import { aiDiscoverCreators } from '@/lib/ai-actions'
import { isBrandOwned } from '@/lib/creator-guardrails'
import { extractCreatorsFromReport, parseGumshoeUrl } from '@/lib/gumshoe'
import { verifyCreator } from '@/lib/verify-creator'
import { searchYouTubeVideosByTerms, VideoDiscoveryResult } from '@/lib/youtube'
import { isYouTubeConfigured } from '@/lib/anthropic'
import { v4 as uuidv4 } from 'uuid'

// ─── Types ───

export interface DiscoveryResult {
  db_matched: number
  yt_search_found: number
  yt_search_new: number
  llm_suggested: number
  llm_new_inserted: number
  llm_deduped: number
  llm_rejected: number
  gumshoe_extracted: number
  total_linked: number
}

interface CampaignContext {
  id: string
  creative_brief: string
  topics: string[]
  personas: string[]
  gumshoe_notes: string
}

interface MatchedCreator {
  id: string
  name: string
  platform: string
  handle: string | null
  source: string
  /** Videos found during discovery — already known to be relevant */
  anchorVideos?: { videoId: string; title: string; publishedAt: string }[]
}

// ─── Phase A: DB Category Matching ───

/**
 * Find existing creators whose categories overlap with campaign topics.
 * Ranks by relationship_status (hot > warm > cold > none).
 * Excludes: excluded=true, brand_owned=true, already linked to this campaign.
 */
export async function discoverByCategories(
  campaignId: string,
  topics: string[],
  limit = 50
): Promise<MatchedCreator[]> {
  if (topics.length === 0) return []

  // Build ILIKE conditions for topic → category name matching
  const conditions = topics.map((_, i) => `cat.name ILIKE $${i + 2}`).join(' OR ')
  const params: unknown[] = [campaignId, ...topics.map(t => `%${t}%`)]

  const res = await dbQuery<MatchedCreator>(
    `SELECT DISTINCT c.id, c.name, c.platform, c.handle,
            'db_match' as source,
            CASE c.relationship_status
              WHEN 'hot' THEN 1
              WHEN 'warm' THEN 2
              WHEN 'cold' THEN 3
              ELSE 4
            END as rel_rank,
            c.subscriber_count
     FROM ${t('creators')} c
     JOIN ${t('creator_categories')} cc2 ON cc2.creator_id = c.id
     JOIN ${t('categories')} cat ON cat.id = cc2.category_id
     WHERE (${conditions})
       AND c.excluded = false
       AND c.brand_owned = false
       AND c.id NOT IN (
         SELECT creator_id FROM ${t('campaign_creators')} WHERE campaign_id = $1
       )
     ORDER BY rel_rank, c.subscriber_count DESC NULLS LAST
     LIMIT ${limit}`,
    params
  )

  return res.data
}

// ─── Phase B: LLM Look-alike Discovery ───

/**
 * Ask LLM to suggest creators, dedup against existing DB, insert new ones, return all.
 */
export async function discoverByLLM(
  campaign: CampaignContext,
  seedCreators: Array<{ name: string; platform: string; handle: string }>,
  count = 20
): Promise<{ suggestions: MatchedCreator[]; newInserted: number; deduped: number; rejected: number }> {
  // Build set of existing platform+handle pairs for dedup
  const existingRes = await dbQuery<{ platform: string; handle: string }>(
    `SELECT platform, handle FROM ${t('creators')} WHERE handle IS NOT NULL`
  )
  const existingHandles = new Set(
    existingRes.data.map(r => `${r.platform}:${(r.handle || '').toLowerCase().replace(/^@/, '')}`)
  )

  const llmResults = await aiDiscoverCreators({
    brief: campaign.creative_brief,
    topics: campaign.topics,
    personas: campaign.personas,
    gumshoeNotes: campaign.gumshoe_notes,
    seedCreators,
    existingHandles,
    count,
  })

  if (llmResults.length === 0) {
    return { suggestions: [], newInserted: 0, deduped: 0, rejected: 0 }
  }

  // Filter to supported platforms only, then exclude brand-owned
  const SUPPORTED_PLATFORMS = new Set(['youtube', 'medium', 'devto'])
  const filtered = llmResults
    .filter(s => SUPPORTED_PLATFORMS.has(s.platform))
    .filter(s => !isBrandOwned(s.name, s.handle, s.url))

  // Check which suggestions already exist in DB (by platform+handle or platform+url)
  const suggestions: MatchedCreator[] = []
  let newInserted = 0
  let deduped = 0
  let rejected = 0
  const now = new Date().toISOString()

  for (const suggestion of filtered) {
    const handle = (suggestion.handle || '').replace(/^@/, '')

    // Try to find existing creator
    let existingId: string | null = null

    if (handle) {
      const existing = await dbQuery<{ id: string }>(
        `SELECT id FROM ${t('creators')} WHERE platform = $1 AND LOWER(handle) = LOWER($2) LIMIT 1`,
        [suggestion.platform, handle]
      )
      if (existing.data.length > 0) {
        existingId = existing.data[0].id
        deduped++
      }
    }

    if (!existingId && suggestion.url) {
      const existing = await dbQuery<{ id: string }>(
        `SELECT id FROM ${t('creators')} WHERE url = $1 LIMIT 1`,
        [suggestion.url]
      )
      if (existing.data.length > 0) {
        existingId = existing.data[0].id
        deduped++
      }
    }

    if (existingId) {
      suggestions.push({
        id: existingId,
        name: suggestion.name,
        platform: suggestion.platform,
        handle: suggestion.handle,
        source: 'ai_discovery',
      })
    } else {
      // Skip brand-owned
      const brandOwned = isBrandOwned(suggestion.name, suggestion.handle, suggestion.url)
      if (brandOwned) {
        deduped++
        continue
      }

      // Verify creator exists on platform with relevant content before inserting
      const verification = await verifyCreator(suggestion, campaign.topics)
      if (!verification.verified) {
        console.log(`[discovery] Rejected ${suggestion.platform}/${handle}: ${verification.reason}`)
        rejected++
        continue
      }

      // Verified — insert new creator
      const creatorId = uuidv4()
      await dbQuery(
        `INSERT INTO ${t('creators')} (id, name, display_name, platform, handle, url, discovered_via, brand_owned, created_at, updated_at)
         VALUES ($1, $2, $2, $3, $4, $5, 'campaign_discovery', false, $6, $6)
         ON CONFLICT DO NOTHING`,
        [creatorId, suggestion.name, suggestion.platform, handle || null, suggestion.url || null, now]
      )

      // Auto-tag with suggested categories
      if (suggestion.suggested_categories?.length > 0) {
        for (const catName of suggestion.suggested_categories) {
          const catRes = await dbQuery<{ id: string }>(
            `SELECT id FROM ${t('categories')} WHERE LOWER(name) = LOWER($1) LIMIT 1`,
            [catName]
          )
          let categoryId: string
          if (catRes.data.length > 0) {
            categoryId = catRes.data[0].id
          } else {
            categoryId = uuidv4()
            await dbQuery(
              `INSERT INTO ${t('categories')} (id, name, created_at) VALUES ($1, $2, now()) ON CONFLICT DO NOTHING`,
              [categoryId, catName]
            )
          }
          await dbQuery(
            `INSERT INTO ${t('creator_categories')} (creator_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [creatorId, categoryId]
          )
        }
      }

      suggestions.push({
        id: creatorId,
        name: suggestion.name,
        platform: suggestion.platform,
        handle: suggestion.handle,
        source: 'ai_discovery',
      })
      newInserted++
    }
  }

  return { suggestions, newInserted, deduped, rejected }
}

// ─── Link Creators to Campaign ───

async function linkCreatorsToCampaign(
  campaignId: string,
  userId: string,
  creators: MatchedCreator[]
): Promise<number> {
  const now = new Date().toISOString()
  let linked = 0

  for (const creator of creators) {
    // Store anchor videos as JSON in notes so prequalify can use them
    const notes = creator.anchorVideos?.length
      ? JSON.stringify({ anchorVideos: creator.anchorVideos })
      : null

    const res = await dbQuery(
      `INSERT INTO ${t('campaign_creators')} (id, campaign_id, creator_id, added_by_user_id, source, pipeline_stage, scoring_status, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'discovered', 'not_scored', $6, $7, $7)
       ON CONFLICT DO NOTHING`,
      [uuidv4(), campaignId, creator.id, userId, creator.source, notes, now]
    )
    if (res.affected_rows > 0) linked++
  }

  return linked
}

// ─── Phase B: YouTube Video-Based Discovery ───

/**
 * Search YouTube for VIDEOS matching campaign search terms, then extract unique channels.
 * Finds creators through their content, not channel names.
 * Each creator comes with "anchor videos" — already known to be relevant.
 */
async function discoverByYouTubeSearch(
  campaignId: string,
  topics: string[]
): Promise<{ creators: MatchedCreator[]; newInserted: number }> {
  const apiKey = process.env.YOUTUBE_API_KEY || ''

  // Load campaign search terms
  const termsRes = await dbQuery<{ term: string }>(
    `SELECT term FROM ${t('campaign_search_terms')} WHERE campaign_id = $1 AND approved = true ORDER BY order_index LIMIT 15`,
    [campaignId]
  )
  let searchTerms = termsRes.data.map(r => r.term)
  if (searchTerms.length === 0) searchTerms = topics

  try {
    const results = await searchYouTubeVideosByTerms(searchTerms, apiKey, {
      resultsPerTerm: 5,
      maxChannels: 40,
      minSubscribers: 500,
    })

    console.log(`[discovery] YouTube Video Search: ${results.length} unique channels from ${searchTerms.length} terms`)

    // Layer 1: Fast static filter for obvious brands
    const afterStatic = results.filter(ch => {
      const handle = ch.handle?.replace(/^@/, '') || null
      if (isBrandOwned(ch.channelTitle, handle, ch.url, ch.description)) {
        console.log(`[discovery] YouTube Search: static filter removed "${ch.channelTitle}"`)
        return false
      }
      return true
    })

    // Layer 2: LLM quality filter — now includes video titles for better signal
    const llmRejects = await llmChannelFilter(afterStatic.map(ch => ({
      channelTitle: ch.channelTitle,
      handle: ch.handle?.replace(/^@/, '') || null,
      description: ch.description + '\nVideos: ' + ch.anchorVideos.map(v => v.title).join('; '),
      subscriberCount: ch.subscriberCount,
    })), topics)

    const filtered = afterStatic.filter(ch => !llmRejects.has(ch.channelTitle))
    console.log(`[discovery] YouTube Search: ${results.length} → ${afterStatic.length} (static) → ${filtered.length} (LLM quality) channels`)

    const creators: MatchedCreator[] = []
    let newInserted = 0
    const now = new Date().toISOString()

    for (const ch of filtered) {
      const handle = ch.handle?.replace(/^@/, '') || null

      // Check if already in DB
      let existingId: string | null = null
      if (handle) {
        const existing = await dbQuery<{ id: string }>(
          `SELECT id FROM ${t('creators')} WHERE platform = 'youtube' AND LOWER(handle) = LOWER($1) LIMIT 1`,
          [handle]
        )
        if (existing.data.length > 0) existingId = existing.data[0].id
      }
      if (!existingId) {
        const existing = await dbQuery<{ id: string }>(
          `SELECT id FROM ${t('creators')} WHERE url = $1 LIMIT 1`,
          [ch.url]
        )
        if (existing.data.length > 0) existingId = existing.data[0].id
      }

      if (existingId) {
        if (ch.subscriberCount) {
          await dbQuery(
            `UPDATE ${t('creators')} SET subscriber_count = $2, updated_at = $3 WHERE id = $1`,
            [existingId, ch.subscriberCount, now]
          )
        }
        creators.push({
          id: existingId,
          name: ch.channelTitle,
          platform: 'youtube',
          handle: handle ? `@${handle}` : null,
          source: 'youtube_search',
          anchorVideos: ch.anchorVideos,
        })
      } else {
        const creatorId = uuidv4()
        await dbQuery(
          `INSERT INTO ${t('creators')} (id, name, display_name, platform, handle, url, subscriber_count, discovered_via, created_at, updated_at)
           VALUES ($1, $2, $2, 'youtube', $3, $4, $5, 'youtube_search', $6, $6)
           ON CONFLICT DO NOTHING`,
          [creatorId, ch.channelTitle, handle, ch.url, ch.subscriberCount, now]
        )
        creators.push({
          id: creatorId,
          name: ch.channelTitle,
          platform: 'youtube',
          handle: handle ? `@${handle}` : null,
          source: 'youtube_search',
          anchorVideos: ch.anchorVideos,
        })
        newInserted++
        console.log(`[discovery] YouTube Video Search: "${ch.channelTitle}" (@${handle}, ${ch.subscriberCount?.toLocaleString() || '?'} subs) — videos: ${ch.anchorVideos.map(v => `"${v.title}"`).join(', ')}`)
      }
    }

    return { creators, newInserted }
  } catch (e) {
    console.error('[discovery] YouTube Search failed:', (e as Error).message)
    return { creators: [], newInserted: 0 }
  }
}

// ─── Phase 0.5: Seed-Based Vocabulary Extraction ───

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

// ─── LLM Channel Quality Filter ───

interface ChannelForQualityCheck {
  channelTitle: string
  handle: string | null
  description: string
  subscriberCount: number | null
}

/**
 * Use LLM to filter channels — reject brands, tutorial mills, academies, and unrelated content.
 * Campaign-aware: uses topics to judge relevance.
 * Returns the set of channel titles to REJECT.
 * One batch LLM call for all channels.
 */
async function llmChannelFilter(
  channels: ChannelForQualityCheck[],
  campaignTopics: string[]
): Promise<Set<string>> {
  if (channels.length === 0) return new Set()

  const channelsBlock = channels.map((ch, i) =>
    `${i + 1}. "${ch.channelTitle}" (@${ch.handle || 'unknown'}, ${ch.subscriberCount?.toLocaleString() || '?'} subs)\n   ${(ch.description || '').slice(0, 150)}`
  ).join('\n')

  try {
    await setupPrompt(
      'filter_channels_quality',
      ['channels_block', 'campaign_topics'],
      `You are filtering YouTube channels for a creator sponsorship campaign. We want INDEPENDENT PRACTITIONERS who share real-world experience — the kind of creator a senior developer would subscribe to.

CAMPAIGN TOPICS: {campaign_topics}

CHANNELS:
{channels_block}

REJECT these types (return their numbers):
- Company/vendor channels, product channels, corporate channels. If it exists to sell a product/service, reject.
- Tutorial mills and academies — channels that ONLY teach beginners step-by-step ("How to Install X", "X Tutorial for Beginners", "Learn X in 10 Minutes"). Names with "Academy", "Learn", "Tutorial", "Mentor" are strong signals.
- Training/certification companies, bootcamp channels
- Conference/event channels
- Content unrelated to the campaign topics (e.g. gaming, cooking, lifestyle, entertainment)

KEEP these types:
- Independent developers sharing production experience, war stories, tool reviews
- Consultants/freelancers with hands-on expertise
- Small creator-led channels where the person IS the brand
- Creators who mix tutorials with real-world insights (not pure tutorial mills)

Return ONLY a JSON array of channel numbers to REJECT (1-indexed), no other text:
[1, 3, 7]

If all should be kept, return: []`
    )

    const raw = await applyPrompt('filter_channels_quality', {
      channels_block: channelsBlock,
      campaign_topics: campaignTopics.join(', '),
    }, 'raw_text') as string

    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const rejectIndices = JSON.parse(cleaned) as number[]

    if (!Array.isArray(rejectIndices)) return new Set()

    const rejectNames = new Set<string>()
    for (const idx of rejectIndices) {
      const ch = channels[idx - 1]
      if (ch) {
        rejectNames.add(ch.channelTitle)
        console.log(`[discovery] LLM quality filter: "${ch.channelTitle}" → rejected`)
      }
    }

    console.log(`[discovery] LLM quality filter: ${rejectNames.size}/${channels.length} rejected`)
    return rejectNames
  } catch (e) {
    console.log(`[discovery] LLM quality filter failed, falling back to static filter: ${(e as Error).message}`)
    return new Set()
  }
}

// ─── Main Discovery Orchestrator ───

/**
 * Run full discovery for a campaign:
 * 1. DB category matching
 * 2. LLM look-alike suggestions
 * 3. Link all to campaign
 * 4. Log activity
 */
export async function runDiscovery(
  campaignId: string,
  userId: string,
  options: { llmCount?: number; dbLimit?: number } = {}
): Promise<DiscoveryResult> {
  // Load campaign context
  const campRes = await dbQuery<{
    creative_brief: string; personas: string[]; gumshoe_notes: string
  }>(
    `SELECT creative_brief, personas, gumshoe_notes FROM ${t('campaigns')} WHERE id = $1`,
    [campaignId]
  )
  if (campRes.data.length === 0) throw new Error('Campaign not found')
  const camp = campRes.data[0]

  // Load topics
  const topicsRes = await dbQuery<{ topic: string }>(
    `SELECT topic FROM ${t('campaign_topics')} WHERE campaign_id = $1 AND approved = true`,
    [campaignId]
  )
  let topics = topicsRes.data.map(r => r.topic)

  // Fall back to all topics if none approved
  if (topics.length === 0) {
    const allTopics = await dbQuery<{ topic: string }>(
      `SELECT topic FROM ${t('campaign_topics')} WHERE campaign_id = $1`,
      [campaignId]
    )
    topics = allTopics.data.map(r => r.topic)
  }

  if (topics.length === 0) throw new Error('No topics found for this campaign')

  const campaign: CampaignContext = {
    id: campaignId,
    creative_brief: camp.creative_brief || '',
    topics,
    personas: camp.personas || [],
    gumshoe_notes: camp.gumshoe_notes || '',
  }

  // Phase 0: Gumshoe citation extraction (if URL + API key available)
  let gumshoeCreators: MatchedCreator[] = []
  const isGumshoeUrl = campaign.gumshoe_notes && parseGumshoeUrl(campaign.gumshoe_notes)
  if (isGumshoeUrl && process.env.GUMSHOE_API_KEY) {
    try {
      const reportId = parseGumshoeUrl(campaign.gumshoe_notes)
      if (reportId) {
        // Store report ID on campaign for future reference
        await dbQuery(
          `UPDATE ${t('campaigns')} SET gumshoe_report_id = $2, updated_at = now() WHERE id = $1`,
          [campaignId, reportId]
        )
      }

      const creatorUrls = await extractCreatorsFromReport(campaign.gumshoe_notes)
      console.log(`[discovery] Gumshoe: found ${creatorUrls.length} creator URLs`)

      const now = new Date().toISOString()
      for (const cu of creatorUrls) {
        // Check if creator already exists
        let existingId: string | null = null
        const existing = await dbQuery<{ id: string }>(
          `SELECT id FROM ${t('creators')} WHERE platform = $1 AND LOWER(handle) = LOWER($2) LIMIT 1`,
          [cu.platform, cu.handle]
        )
        if (existing.data.length > 0) {
          existingId = existing.data[0].id
        }

        if (!existingId) {
          // Try by URL
          const byUrl = await dbQuery<{ id: string }>(
            `SELECT id FROM ${t('creators')} WHERE url = $1 LIMIT 1`,
            [cu.url]
          )
          if (byUrl.data.length > 0) {
            existingId = byUrl.data[0].id
          }
        }

        if (!existingId) {
          // Insert new creator
          existingId = uuidv4()
          const name = cu.handle // Will be enriched later
          await dbQuery(
            `INSERT INTO ${t('creators')} (id, name, display_name, platform, handle, url, discovered_via, created_at, updated_at)
             VALUES ($1, $2, $2, $3, $4, $5, 'gumshoe', $6, $6)
             ON CONFLICT DO NOTHING`,
            [existingId, name, cu.platform, cu.handle, cu.url, now]
          )
        }

        gumshoeCreators.push({
          id: existingId,
          name: cu.handle,
          platform: cu.platform,
          handle: cu.handle,
          source: 'gumshoe',
        })
      }
    } catch (e) {
      console.log(`[discovery] Gumshoe extraction failed, continuing: ${(e as Error).message}`)
      gumshoeCreators = []
    }
  }

  // Phase A: DB category matching
  const dbMatched = await discoverByCategories(campaignId, topics, options.dbLimit || 50)

  // Phase B: YouTube Video Search — find creators through their content, not channel names
  let ytSearchCreators: MatchedCreator[] = []
  let ytSearchNew = 0
  if (isYouTubeConfigured()) {
    const ytResult = await discoverByYouTubeSearch(campaignId, topics)
    ytSearchCreators = ytResult.creators
    ytSearchNew = ytResult.newInserted
    console.log(`[discovery] YouTube Video Search: ${ytResult.creators.length} channels found (${ytResult.newInserted} new)`)
  } else {
    console.log('[discovery] YouTube API key not configured, skipping YouTube search')
  }

  // Load seed creators for LLM (use existing campaign creators or top DB matches)
  const seedRes = await dbQuery<{ name: string; platform: string; handle: string }>(
    `SELECT c.name, c.platform, c.handle
     FROM ${t('campaign_creators')} cc
     JOIN ${t('creators')} c ON c.id = cc.creator_id
     WHERE cc.campaign_id = $1 AND c.handle IS NOT NULL
     LIMIT 5`,
    [campaignId]
  )
  const seeds = seedRes.data.length > 0
    ? seedRes.data
    : dbMatched.slice(0, 5).filter(c => c.handle).map(c => ({
        name: c.name, platform: c.platform, handle: c.handle!,
      }))

  // Phase C: LLM look-alike discovery (supplementary to API search)
  const llmResult = await discoverByLLM(campaign, seeds, options.llmCount || 20)

  // Link all discovered creators to campaign
  const allCreators = [...gumshoeCreators, ...dbMatched, ...ytSearchCreators, ...llmResult.suggestions]
  const totalLinked = await linkCreatorsToCampaign(campaignId, userId, allCreators)

  // Log activity
  const result: DiscoveryResult = {
    db_matched: dbMatched.length,
    yt_search_found: ytSearchCreators.length,
    yt_search_new: ytSearchNew,
    llm_suggested: llmResult.suggestions.length,
    llm_new_inserted: llmResult.newInserted,
    llm_deduped: llmResult.deduped,
    llm_rejected: llmResult.rejected,
    gumshoe_extracted: gumshoeCreators.length,
    total_linked: totalLinked,
  }

  if (ytSearchCreators.length > 0) {
    console.log(`[discovery] YouTube Search API: ${ytSearchCreators.length} channels linked`)
  }
  if (llmResult.rejected > 0) {
    console.log(`[discovery] Verification rejected ${llmResult.rejected} LLM-suggested creators (fictional or wrong person)`)
  }

  await dbQuery(
    `INSERT INTO ${t('activity_log')} (campaign_id, actor_user_id, event_type, event_data_json, created_at)
     VALUES ($1, $2, 'discovery', $3::jsonb, now())`,
    [campaignId, userId, JSON.stringify(result)]
  )

  return result
}
