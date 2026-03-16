/**
 * V2 Discovery: DB category matching + LLM look-alike suggestions.
 *
 * Phase A: Match existing creators by category overlap with campaign topics.
 * Phase B: LLM suggests new creators → dedup → insert → link.
 */

import { dbQuery, t } from '@/lib/db'
import { aiDiscoverCreators } from '@/lib/ai-actions'
import { v4 as uuidv4 } from 'uuid'

// ─── Types ───

export interface DiscoveryResult {
  db_matched: number
  llm_suggested: number
  llm_new_inserted: number
  llm_deduped: number
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
): Promise<{ suggestions: MatchedCreator[]; newInserted: number; deduped: number }> {
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
    return { suggestions: [], newInserted: 0, deduped: 0 }
  }

  // Filter to supported platforms only
  const SUPPORTED_PLATFORMS = new Set(['youtube', 'medium', 'devto'])
  const filtered = llmResults.filter(s => SUPPORTED_PLATFORMS.has(s.platform))

  // Check which suggestions already exist in DB (by platform+handle or platform+url)
  const suggestions: MatchedCreator[] = []
  let newInserted = 0
  let deduped = 0
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
      // Insert new creator
      const creatorId = uuidv4()
      await dbQuery(
        `INSERT INTO ${t('creators')} (id, name, display_name, platform, handle, url, discovered_via, created_at, updated_at)
         VALUES ($1, $2, $2, $3, $4, $5, 'campaign_discovery', $6, $6)
         ON CONFLICT DO NOTHING`,
        [creatorId, suggestion.name, suggestion.platform, handle || null, suggestion.url || null, now]
      )

      // Auto-tag with suggested categories
      if (suggestion.suggested_categories?.length > 0) {
        for (const catName of suggestion.suggested_categories) {
          // Find or create category
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

  return { suggestions, newInserted, deduped }
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
    const res = await dbQuery(
      `INSERT INTO ${t('campaign_creators')} (id, campaign_id, creator_id, added_by_user_id, source, pipeline_stage, scoring_status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'discovered', 'not_scored', $6, $6)
       ON CONFLICT DO NOTHING`,
      [uuidv4(), campaignId, creator.id, userId, creator.source, now]
    )
    if (res.affected_rows > 0) linked++
  }

  return linked
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

  // Phase A: DB category matching
  const dbMatched = await discoverByCategories(campaignId, topics, options.dbLimit || 50)

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

  // Phase B: LLM look-alike discovery
  const llmResult = await discoverByLLM(campaign, seeds, options.llmCount || 20)

  // Link all discovered creators to campaign
  const allCreators = [...dbMatched, ...llmResult.suggestions]
  const totalLinked = await linkCreatorsToCampaign(campaignId, userId, allCreators)

  // Log activity
  const result: DiscoveryResult = {
    db_matched: dbMatched.length,
    llm_suggested: llmResult.suggestions.length,
    llm_new_inserted: llmResult.newInserted,
    llm_deduped: llmResult.deduped,
    total_linked: totalLinked,
  }

  await dbQuery(
    `INSERT INTO ${t('activity_log')} (campaign_id, actor_user_id, event_type, event_data_json, created_at)
     VALUES ($1, $2, 'discovery', $3::jsonb, now())`,
    [campaignId, userId, JSON.stringify(result)]
  )

  return result
}
