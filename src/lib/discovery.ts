/**
 * V2 Discovery: DB matching + YouTube API search + LLM look-alike suggestions.
 *
 * Phase 0: Gumshoe citation extraction (if URL + API key available)
 * Phase A: Match existing creators by category overlap with campaign topics.
 * Phase B: YouTube Search API — find real channels by campaign search terms.
 * Phase C: LLM suggests new creators → verify → dedup → insert → link.
 */

import { dbQuery, dbInsertMany, t, callAIApi } from '@/lib/db'
import { aiDiscoverCreators } from '@/lib/ai-actions'
import { isBrandOwned } from '@/lib/creator-guardrails'
import { extractCreatorsFromReport, parseGumshoeUrl } from '@/lib/gumshoe'
import { verifyCreator, VerificationResult } from '@/lib/verify-creator'
import { searchYouTubeVideosByTerms, VideoDiscoveryResult } from '@/lib/youtube'
import { isYouTubeConfigured } from '@/lib/anthropic'
import { v4 as uuidv4 } from 'uuid'

// ─── Types ───

export interface DiscoveryResult {
  db_matched: number
  yt_search_found: number
  yt_search_new: number
  rapid_research_found: number
  rapid_research_new: number
  devto_search_found: number
  devto_search_new: number
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
  // Collect category pairs from new creators — batched after all suggestions processed
  const categoryPairs: { creatorId: string; catName: string }[] = []

  // Process suggestions in parallel batches with timeout (prevents pipeline hang)
  const VERIFY_BATCH_SIZE = 5
  const VERIFY_TIMEOUT_MS = 15_000

  const processSuggestion = async (suggestion: typeof filtered[0]): Promise<
    | { type: 'existing'; creator: MatchedCreator }
    | { type: 'brand' }
    | { type: 'rejected' }
    | { type: 'new'; creator: MatchedCreator }
  > => {
    const handle = (suggestion.handle || '').replace(/^@/, '')

    // Try to find existing creator
    let existingId: string | null = null

    if (handle) {
      const existing = await dbQuery<{ id: string }>(
        `SELECT id FROM ${t('creators')} WHERE platform = $1 AND LOWER(handle) = LOWER($2) LIMIT 1`,
        [suggestion.platform, handle]
      )
      if (existing.data.length > 0) existingId = existing.data[0].id
    }

    if (!existingId && suggestion.url) {
      const existing = await dbQuery<{ id: string }>(
        `SELECT id FROM ${t('creators')} WHERE url = $1 LIMIT 1`,
        [suggestion.url]
      )
      if (existing.data.length > 0) existingId = existing.data[0].id
    }

    if (existingId) {
      return {
        type: 'existing',
        creator: { id: existingId, name: suggestion.name, platform: suggestion.platform, handle: suggestion.handle, source: 'ai_discovery' },
      }
    }

    // Skip brand-owned
    if (isBrandOwned(suggestion.name, suggestion.handle, suggestion.url)) {
      return { type: 'brand' }
    }

    // Verify creator exists on platform — with timeout to prevent hangs
    const verification = await Promise.race([
      verifyCreator(suggestion, campaign.topics),
      new Promise<VerificationResult>(resolve =>
        setTimeout(() => resolve({ verified: false, reason: 'Verification timed out (15s)' }), VERIFY_TIMEOUT_MS)
      ),
    ])

    if (!verification.verified) {
      console.log(`[discovery] Rejected ${suggestion.platform}/${handle}: ${verification.reason}`)
      return { type: 'rejected' }
    }

    // Insert verified new creator into global network
    const newId = uuidv4()
    const cleanHandle = handle || null
    await dbInsertMany(
      t('creators'),
      ['id', 'name', 'display_name', 'platform', 'handle', 'url', 'discovered_via', 'created_at', 'updated_at'],
      [[newId, suggestion.name, suggestion.name, suggestion.platform, cleanHandle, suggestion.url || null, 'llm_discovery', now, now]],
      'DO NOTHING'
    )
    console.log(`[discovery] Phase C: inserted new creator "${suggestion.name}" (${suggestion.platform}/${cleanHandle || suggestion.url})`)
    if (suggestion.suggested_categories?.length) {
      categoryPairs.push(...suggestion.suggested_categories.map((catName: string) => ({ creatorId: newId, catName })))
    }
    return { type: 'new', creator: { id: newId, name: suggestion.name, platform: suggestion.platform, handle: suggestion.handle || null, source: 'ai_discovery' } }
  }

  // Run in batches of 5 to limit concurrent API calls
  for (let i = 0; i < filtered.length; i += VERIFY_BATCH_SIZE) {
    const batch = filtered.slice(i, i + VERIFY_BATCH_SIZE)
    const batchResults = await Promise.allSettled(batch.map(processSuggestion))

    for (const result of batchResults) {
      if (result.status === 'rejected') {
        console.log(`[discovery] Verification error: ${result.reason}`)
        rejected++
        continue
      }
      switch (result.value.type) {
        case 'existing':
          suggestions.push(result.value.creator)
          deduped++
          break
        case 'brand':
          deduped++
          break
        case 'rejected':
          rejected++
          break
        case 'new':
          suggestions.push(result.value.creator)
          newInserted++
          break
      }
    }
  }

  // Batch-tag categories for all newly inserted creators
  if (categoryPairs.length > 0) {
    await batchTagCategories(categoryPairs)
  }

  return { suggestions, newInserted, deduped, rejected }
}

// ─── Batch Category Tagging ───

export async function batchTagCategories(pairs: { creatorId: string; catName: string }[]): Promise<void> {
  if (pairs.length === 0) return

  const uniqueNames = Array.from(new Set(pairs.map(p => p.catName.toLowerCase())))

  // Fetch all existing categories in one query
  const placeholders = uniqueNames.map((_, i) => `LOWER($${i + 1})`).join(', ')
  const existingRes = await dbQuery<{ id: string; name: string }>(
    `SELECT id, name FROM ${t('categories')} WHERE LOWER(name) IN (${placeholders})`,
    uniqueNames
  )
  const existingMap = new Map(existingRes.data.map(r => [r.name.toLowerCase(), r.id]))

  // Insert missing categories
  const missingNames = uniqueNames.filter(n => !existingMap.has(n))
  if (missingNames.length > 0) {
    const now = new Date().toISOString()
    const newIds = missingNames.map(() => uuidv4())
    await dbInsertMany(
      t('categories'),
      ['id', 'name', 'created_at'],
      missingNames.map((name, i) => [newIds[i], name, now]),
      'DO NOTHING'
    )
    // Fetch back inserted categories (ON CONFLICT may have deduped some)
    const insertedRes = await dbQuery<{ id: string; name: string }>(
      `SELECT id, name FROM ${t('categories')} WHERE LOWER(name) IN (${placeholders})`,
      uniqueNames
    )
    for (const r of insertedRes.data) {
      existingMap.set(r.name.toLowerCase(), r.id)
    }
  }

  // Batch insert creator_categories mappings
  const mappingRows = pairs
    .map(p => {
      const catId = existingMap.get(p.catName.toLowerCase())
      return catId ? [p.creatorId, catId] : null
    })
    .filter((r): r is [string, string] => r !== null)

  if (mappingRows.length > 0) {
    await dbInsertMany(
      t('creator_categories'),
      ['creator_id', 'category_id'],
      mappingRows,
      'DO NOTHING'
    )
  }
}

// ─── Link Creators to Campaign ───

async function linkCreatorsToCampaign(
  campaignId: string,
  userId: string,
  creators: MatchedCreator[]
): Promise<number> {
  if (creators.length === 0) return 0

  const now = new Date().toISOString()
  const rows = creators.map(creator => {
    const notes = creator.anchorVideos?.length
      ? JSON.stringify({ anchorVideos: creator.anchorVideos })
      : null
    return [uuidv4(), campaignId, creator.id, userId, creator.source, 'discovered', 'not_scored', notes, now, now]
  })

  const res = await dbInsertMany(
    t('campaign_creators'),
    ['id', 'campaign_id', 'creator_id', 'added_by_user_id', 'source', 'pipeline_stage', 'scoring_status', 'notes', 'created_at', 'updated_at'],
    rows,
    'DO NOTHING'
  )
  return res.affected_rows
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
    const llmResult = await llmChannelFilter(afterStatic.map(ch => ({
      channelTitle: ch.channelTitle,
      handle: ch.handle?.replace(/^@/, '') || null,
      description: ch.description,
      subscriberCount: ch.subscriberCount,
      anchorVideos: ch.anchorVideos,
    })), topics)

    const filtered = afterStatic.filter(ch => !llmResult.rejected.has(ch.channelTitle))
    console.log(`[discovery] YouTube Search: ${results.length} → ${afterStatic.length} (static) → ${filtered.length} (LLM quality) channels`)

    const creators: MatchedCreator[] = []
    let newInserted = 0
    const now = new Date().toISOString()

    // Batch lookup: collect handles and URLs, one query to find all existing creators
    const channelsWithHandles = filtered.map(ch => ({
      ch,
      handle: ch.handle?.replace(/^@/, '') || null,
    }))

    const allHandles = channelsWithHandles.map(c => c.handle).filter((h): h is string => !!h)
    const allUrls = channelsWithHandles.map(c => c.ch.url).filter(Boolean)

    const existingMap = new Map<string, string>() // handle_lower or url → creator id
    if (allHandles.length > 0 || allUrls.length > 0) {
      const handlePlaceholders = allHandles.map((_, i) => `LOWER($${i + 1})`).join(', ')
      const urlPlaceholders = allUrls.map((_, i) => `$${allHandles.length + i + 1}`).join(', ')
      const conditions: string[] = []
      if (allHandles.length > 0) conditions.push(`(platform = 'youtube' AND LOWER(handle) IN (${handlePlaceholders}))`)
      if (allUrls.length > 0) conditions.push(`url IN (${urlPlaceholders})`)
      const existingRes = await dbQuery<{ id: string; handle: string | null; url: string | null }>(
        `SELECT id, handle, url FROM ${t('creators')} WHERE ${conditions.join(' OR ')}`,
        [...allHandles, ...allUrls]
      )
      for (const row of existingRes.data) {
        if (row.handle) existingMap.set(row.handle.toLowerCase(), row.id)
        if (row.url) existingMap.set(row.url, row.id)
      }
    }

    // Split into existing vs new
    const toUpdate: { id: string; subscriberCount: number }[] = []
    const toInsert: typeof channelsWithHandles = []

    for (const { ch, handle } of channelsWithHandles) {
      const existingId = (handle && existingMap.get(handle.toLowerCase())) || existingMap.get(ch.url) || null
      if (existingId) {
        if (ch.subscriberCount) toUpdate.push({ id: existingId, subscriberCount: ch.subscriberCount })
        creators.push({ id: existingId, name: ch.channelTitle, platform: 'youtube', handle: handle ? `@${handle}` : null, source: 'youtube_search', anchorVideos: ch.anchorVideos })
      } else {
        toInsert.push({ ch, handle })
      }
    }

    // Batch update subscriber counts for existing creators
    for (const { id, subscriberCount } of toUpdate) {
      // Individual updates are unavoidable without CASE WHEN — keep parallel
      await dbQuery(`UPDATE ${t('creators')} SET subscriber_count = $2, updated_at = $3 WHERE id = $1`, [id, subscriberCount, now])
    }

    // Batch insert new creators
    const ytCategoryPairs: { creatorId: string; catName: string }[] = []
    if (toInsert.length > 0) {
      const newRows = toInsert.map(({ ch, handle }) => [uuidv4(), ch.channelTitle, 'youtube', handle, ch.url, ch.subscriberCount, 'youtube_search', now, now])
      await dbInsertMany(
        t('creators'),
        ['id', 'name', 'display_name', 'platform', 'handle', 'url', 'subscriber_count', 'discovered_via', 'created_at', 'updated_at'],
        newRows.map(r => [r[0], r[1], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8]]),
        'DO NOTHING'
      )
      for (let i = 0; i < toInsert.length; i++) {
        const { ch, handle } = toInsert[i]
        const creatorId = newRows[i][0] as string
        creators.push({ id: creatorId, name: ch.channelTitle, platform: 'youtube', handle: handle ? `@${handle}` : null, source: 'youtube_search', anchorVideos: ch.anchorVideos })
        newInserted++
        // Collect LLM-assigned categories for batch tagging
        const cats = llmResult.categories.get(ch.channelTitle)
        if (cats?.length) {
          ytCategoryPairs.push(...cats.map(catName => ({ creatorId, catName })))
        }
        console.log(`[discovery] YouTube Video Search: "${ch.channelTitle}" (${handle ? '@' + handle : 'no handle'}, ${ch.subscriberCount?.toLocaleString() || '?'} subs) — videos: ${ch.anchorVideos.map(v => `"${v.title}"`).join(', ')}`)
      }
    }

    if (ytCategoryPairs.length > 0) {
      await batchTagCategories(ytCategoryPairs)
    }

    return { creators, newInserted }
  } catch (e) {
    console.error('[discovery] YouTube Search failed:', (e as Error).message)
    return { creators: [], newInserted: 0 }
  }
}

// ─── Phase B2: Medium + Dev.to Discovery ───

/**
 * Scan a block of text (e.g. rapid_research response) for Medium and Dev.to profile URLs.
 */
function extractProfileUrlsFromText(text: string): Array<{ platform: 'medium' | 'devto'; handle: string; url: string }> {
  const results: Array<{ platform: 'medium' | 'devto'; handle: string; url: string }> = []
  const seen = new Set<string>()

  const mediumRe = /medium\.com\/@([\w.-]+)/gi
  let m: RegExpExecArray | null
  while ((m = mediumRe.exec(text)) !== null) {
    const handle = m[1].replace(/[.,;)]+$/, '')
    const key = `medium:${handle.toLowerCase()}`
    if (!seen.has(key)) {
      seen.add(key)
      results.push({ platform: 'medium', handle, url: `https://medium.com/@${handle}` })
    }
  }

  const DEVTO_RESERVED = new Set(['t', 'tag', 'search', 'top', 'settings', 'api', 'admin', 'pod'])
  const devtoRe = /dev\.to\/([\w-]+)/gi
  while ((m = devtoRe.exec(text)) !== null) {
    const handle = m[1].replace(/[.,;)]+$/, '')
    if (DEVTO_RESERVED.has(handle.toLowerCase())) continue
    const key = `devto:${handle.toLowerCase()}`
    if (!seen.has(key)) {
      seen.add(key)
      results.push({ platform: 'devto', handle, url: `https://dev.to/${handle}` })
    }
  }

  return results
}

/**
 * Shared verify → dedup → insert logic for Medium and Dev.to creators.
 */
async function insertDiscoveredCreators(
  handles: Array<{ platform: 'medium' | 'devto'; handle: string; url: string }>,
  discoveredVia: string
): Promise<{ creators: MatchedCreator[]; newInserted: number }> {
  if (handles.length === 0) return { creators: [], newInserted: 0 }
  const now = new Date().toISOString()

  const afterHeuristics = Array.from(
    new Map(handles.map(h => [`${h.platform}:${h.handle.toLowerCase()}`, h])).values()
  ).filter(h => !isBrandOwned(h.handle, h.handle, h.url))

  // LLM brand filter — runs before verifyCreator to avoid wasting API calls on obvious rejects
  const llmRejected = await llmCreatorFilter(afterHeuristics)
  const unique = afterHeuristics.filter(h => !llmRejected.has(h.handle.toLowerCase()))

  const existingRes = await dbQuery<{ id: string; platform: string; handle: string }>(
    `SELECT id, platform, handle FROM ${t('creators')}
     WHERE platform IN ('medium', 'devto') AND LOWER(handle) = ANY($1)`,
    [unique.map(h => h.handle.toLowerCase())]
  )
  const existingMap = new Map(existingRes.data.map(r => [`${r.platform}:${r.handle.toLowerCase()}`, r.id]))

  const creators: MatchedCreator[] = []
  let newInserted = 0
  const toVerify: typeof unique = []

  for (const h of unique) {
    const id = existingMap.get(`${h.platform}:${h.handle.toLowerCase()}`)
    if (id) {
      creators.push({ id, name: h.handle, platform: h.platform, handle: h.handle, source: discoveredVia })
    } else {
      toVerify.push(h)
    }
  }

  for (let i = 0; i < toVerify.length; i += 5) {
    const batch = toVerify.slice(i, i + 5)
    const results = await Promise.allSettled(batch.map(async h => {
      const v = await Promise.race([
        verifyCreator({ name: h.handle, platform: h.platform, handle: h.handle, url: h.url, suggested_categories: [] }, []),
        new Promise<VerificationResult>(resolve => setTimeout(() => resolve({ verified: false, reason: 'timeout' }), 15_000)),
      ])
      if (!v.verified) {
        console.log(`[discovery] ${discoveredVia}: rejected ${h.platform}/${h.handle} — ${v.reason}`)
        return null
      }
      return { ...h, id: uuidv4() }
    }))

    const verified = results.flatMap(r => r.status === 'fulfilled' && r.value ? [r.value] : [])
    if (verified.length === 0) continue

    await dbInsertMany(
      t('creators'),
      ['id', 'name', 'display_name', 'platform', 'handle', 'url', 'discovered_via', 'created_at', 'updated_at'],
      verified.map(h => [h.id, h.handle, h.handle, h.platform, h.handle, h.url, discoveredVia, now, now]),
      'DO NOTHING'
    )
    for (const h of verified) {
      creators.push({ id: h.id, name: h.handle, platform: h.platform, handle: h.handle, source: discoveredVia })
      newInserted++
      console.log(`[discovery] ${discoveredVia}: inserted ${h.platform}/${h.handle}`)
    }
  }

  return { creators, newInserted }
}

/**
 * Discover Medium creators using rapid_research (AI-powered web search).
 * Medium is behind Cloudflare so direct scraping isn't viable.
 */
export async function discoverByRapidResearch(
  topics: string[]
): Promise<{ creators: MatchedCreator[]; newInserted: number }> {
  const topicStr = topics.slice(0, 5).join(', ')
  try {
    const res = await callAIApi('/rapid_research', {
      goal: `Find 8 independent individual technical writers on Medium who publish about: ${topicStr}. Exclude company blogs and vendor accounts. List their Medium profile URLs in the format medium.com/@handle.`,
    }) as { value: string }
    const handles = extractProfileUrlsFromText(res.value || '').filter(h => h.platform === 'medium')
    console.log(`[discovery] rapid_research: found ${handles.length} Medium handles`)
    return insertDiscoveredCreators(handles, 'rapid_research')
  } catch (e) {
    console.log(`[discovery] rapid_research failed: ${(e as Error).message}`)
    return { creators: [], newInserted: 0 }
  }
}

/**
 * Discover Dev.to creators using their public tag-based article search API.
 */
export async function discoverByDevtoTagSearch(
  topics: string[]
): Promise<{ creators: MatchedCreator[]; newInserted: number }> {
  try {
    const { searchDevtoByTopics } = await import('@/lib/devto')
    const authors = await searchDevtoByTopics(topics)
    console.log(`[discovery] Dev.to tag search: found ${authors.length} authors`)
    const handles = authors.map(a => ({ platform: 'devto' as const, handle: a.username, url: a.profile_url }))
    return insertDiscoveredCreators(handles, 'devto_search')
  } catch (e) {
    console.log(`[discovery] Dev.to tag search failed: ${(e as Error).message}`)
    return { creators: [], newInserted: 0 }
  }
}

// ─── LLM Channel Quality Filter ───

export interface ChannelForQualityCheck {
  channelTitle: string
  handle: string | null
  description: string
  subscriberCount: number | null
  anchorVideos?: { title: string }[]
}

export interface LLMFilterResult {
  rejected: Set<string>
  /** channelTitle → category names assigned by LLM */
  categories: Map<string, string[]>
}

/**
 * Use LLM to filter channels — reject brands, tutorial mills, academies, and unrelated content.
 * Also assigns categories to kept channels from the campaign topics list.
 * Campaign-aware: uses topics to judge relevance.
 * Uses create-agent + chat for stronger model quality than apply_prompt_to_data.
 */
const QUALITY_FILTER_INSTRUCTIONS = `You are a YouTube channel quality filter for creator sponsorship campaigns. We want INDEPENDENT PRACTITIONERS who share real-world experience — the kind of creator a senior engineer would subscribe to for their own professional growth.

TEST 1 — PERSON OR INSTITUTION?
Is this a single person sharing their expertise, or an organization/company/product producing content?
- REJECT: companies marketing their own product (GitHub, Docker, GitLab, HashiCorp, Datadog, Better Stack, Grafana), educational institutions (freeCodeCamp, Simplilearn, edureka, KodeKloud), bootcamps, conference channels, consulting firms
- REJECT: the official channel of a tool or product itself — even if educational (e.g. the official GitHub channel, the official Kubernetes channel)
- KEEP: individual practitioners, even if they have a recognizable brand name or sell courses (e.g. Fireship, Theo, ThePrimeagen, NetworkChuck, TechWorld with Nana)

TEST 2 — PRACTITIONER OR TEACHER?
Does this channel target working engineers solving real problems, or students learning from scratch?
- REJECT: channels whose primary audience is beginners/students, structured curriculum channels
- KEEP: opinionated takes, war stories, tool deep-dives, production experience — content a senior engineer watches for their own work

CATEGORIES RULE: Every kept channel MUST be assigned at least one category from the provided topics list. No kept channel may be omitted.

Return JSON only:
{ "reject": [1-indexed numbers], "categories": { "index": ["Category"] } }
Example: { "reject": [2, 5], "categories": { "1": ["DevOps"], "3": ["DevOps", "CI/CD"] } }`

const FILTER_BATCH_SIZE = 15

export async function llmChannelFilter(
  channels: ChannelForQualityCheck[],
  campaignTopics: string[]
): Promise<LLMFilterResult> {
  if (channels.length === 0) return { rejected: new Set(), categories: new Map() }

  console.log(`[llmChannelFilter] topics: ${campaignTopics.join(', ')} | channels: ${channels.length}`)

  try {
    // Create agent once — idempotent, 0 credits
    await callAIApi('/create-agent', {
      agent_name: 'yard_quality_filter',
      instructions: QUALITY_FILTER_INSTRUCTIONS,
    })

    const rejected = new Set<string>()
    const categories = new Map<string, string[]>()
    const ts = Date.now()

    // Process in batches of FILTER_BATCH_SIZE to avoid payload size limits
    for (let batchStart = 0; batchStart < channels.length; batchStart += FILTER_BATCH_SIZE) {
      const batch = channels.slice(batchStart, batchStart + FILTER_BATCH_SIZE)
      const batchIndex = Math.floor(batchStart / FILTER_BATCH_SIZE)

      const channelsBlock = batch.map((ch, i) => {
        const desc = (ch.description || '').trim().slice(0, 400)
        const videos = ch.anchorVideos?.length
          ? `\n   Recent videos: ${ch.anchorVideos.slice(0, 3).map(v => `"${v.title}"`).join(', ')}`
          : ''
        return `${i + 1}. "${ch.channelTitle}" (@${ch.handle || 'unknown'}, ${ch.subscriberCount?.toLocaleString() || '?'} subs)\n   ${desc}${videos}`
      }).join('\n')

      const message = `TOPICS: ${campaignTopics.join(', ')}

CHANNELS:
${channelsBlock}

Return JSON only. Every kept channel must appear in categories.`

      const result = await callAIApi('/chat', {
        agent_id: 'yard_quality_filter',
        session_id: `filter-${ts}-batch-${batchIndex}`,
        message,
      }) as { response: string }

      const cleaned = result.response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const parsed = JSON.parse(cleaned) as { reject?: number[]; categories?: Record<string, string[]> }

      const rejectIndices = Array.isArray(parsed.reject) ? parsed.reject : []
      const categoriesRaw = parsed.categories && typeof parsed.categories === 'object' ? parsed.categories : {}

      for (const idx of rejectIndices) {
        const ch = batch[idx - 1]
        if (ch) {
          rejected.add(ch.channelTitle)
          console.log(`[discovery] LLM quality filter: "${ch.channelTitle}" → rejected`)
        }
      }

      for (const [idxStr, cats] of Object.entries(categoriesRaw)) {
        const ch = batch[parseInt(idxStr, 10) - 1]
        if (ch && Array.isArray(cats) && cats.length > 0) {
          categories.set(ch.channelTitle, cats)
        }
      }
    }

    console.log(`[discovery] LLM quality filter: ${rejected.size}/${channels.length} rejected, ${categories.size} categorised`)
    return { rejected, categories }
  } catch (e) {
    console.log(`[discovery] LLM quality filter failed: ${(e as Error).message}`)
    throw new Error('Quality filter failed — please try discovery again')
  }
}

// ─── LLM Creator Quality Filter (Medium + Dev.to) ───

const CREATOR_FILTER_INSTRUCTIONS = `You are a creator quality filter for a technical content sponsorship platform. We want INDEPENDENT INDIVIDUAL developers and writers sharing real technical experience.

KEEP: Individual developers, engineers, or writers who share their own technical experience — even if they have a personal brand or sell courses.

REJECT any of the following:
- Company, startup, product, or project accounts (e.g. tangle_network, braingemai, ntctech, infra_tools)
- Handles that look auto-generated or machine-created (random numbers/letters, no clear human identity)
- Corporate blog arms or brand evangelist accounts
- Gibberish or spam-looking handles

Return JSON only: { "reject": ["handle1", "handle2", ...] }
If none should be rejected, return: { "reject": [] }`

const CREATOR_FILTER_BATCH_SIZE = 10

/**
 * Use LLM to filter Medium/Dev.to handles — reject brand accounts and junk handles.
 * Runs before verifyCreator to avoid wasting verification API calls on obvious rejects.
 */
async function llmCreatorFilter(
  handles: Array<{ platform: string; handle: string; url: string }>
): Promise<Set<string>> {
  if (handles.length === 0) return new Set()

  try {
    await callAIApi('/create-agent', {
      agent_name: 'yard_creator_filter',
      instructions: CREATOR_FILTER_INSTRUCTIONS,
    })

    const rejected = new Set<string>()
    const ts = Date.now()

    for (let batchStart = 0; batchStart < handles.length; batchStart += CREATOR_FILTER_BATCH_SIZE) {
      const batch = handles.slice(batchStart, batchStart + CREATOR_FILTER_BATCH_SIZE)
      const batchIndex = Math.floor(batchStart / CREATOR_FILTER_BATCH_SIZE)

      const handlesList = batch.map((h, i) => `${i + 1}. ${h.platform}/${h.handle} (${h.url})`).join('\n')
      const message = `Classify these creator handles:\n\n${handlesList}\n\nReturn JSON: { "reject": ["handle1", ...] }`

      const result = await callAIApi('/chat', {
        agent_id: 'yard_creator_filter',
        session_id: `creator-filter-${ts}-batch-${batchIndex}`,
        message,
      }) as { response: string }

      const cleaned = result.response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const parsed = JSON.parse(cleaned) as { reject?: string[] }
      const rejectHandles = Array.isArray(parsed.reject) ? parsed.reject : []

      for (const handle of rejectHandles) {
        rejected.add(handle.toLowerCase())
        console.log(`[discovery] LLM creator filter: "${handle}" → rejected`)
      }
    }

    console.log(`[discovery] LLM creator filter: ${rejected.size}/${handles.length} rejected`)
    return rejected
  } catch (e) {
    // Non-fatal: if the LLM filter fails, proceed without it (isBrandOwned still ran)
    console.log(`[discovery] LLM creator filter failed: ${(e as Error).message} — skipping`)
    return new Set()
  }
}

// ─── Standalone Creator Discovery (no campaign) ───

export interface StandaloneDiscoveryResult {
  searched: number
  filtered: number
  new_inserted: number
  already_existed: number
}

/**
 * Discover YouTube creators by category, independent of any campaign.
 * 1. Fetch category names from DB
 * 2. LLM generates search terms from categories
 * 3. YouTube Search API
 * 4. Static + LLM quality filter (also assigns categories)
 * 5. Dedup against existing creators
 * 6. Insert new creators with subscriber counts + categories
 */
export async function discoverCreatorsByCategories(
  categoryIds: string[]
): Promise<StandaloneDiscoveryResult> {
  const { aiGenerateSearchTermsFromCategories } = await import('@/lib/ai-actions')

  // Step 1: Fetch category names — 1 DB call
  const placeholders = categoryIds.map((_, i) => `$${i + 1}`).join(', ')
  const catRes = await dbQuery<{ id: string; name: string }>(
    `SELECT id, name FROM ${t('categories')} WHERE id IN (${placeholders})`,
    categoryIds
  )
  const categoryNames = catRes.data.map(r => r.name)
  if (categoryNames.length === 0) throw new Error('No matching categories found')

  // Step 2: Generate search terms via LLM — 1 AI call
  const searchTerms = await aiGenerateSearchTermsFromCategories(categoryNames)
  if (searchTerms.length === 0) throw new Error('Failed to generate search terms from categories')

  // Step 3: YouTube Search API — external, no credit cost
  const apiKey = process.env.YOUTUBE_API_KEY || ''
  const results = await searchYouTubeVideosByTerms(searchTerms, apiKey, {
    resultsPerTerm: 5,
    maxChannels: 100,
    minSubscribers: 500,
  })
  console.log(`[standalone-discovery] YouTube: ${results.length} channels from ${searchTerms.length} terms`)

  // Step 4a: Static brand filter — free
  const afterStatic = results.filter(ch => {
    const handle = ch.handle?.replace(/^@/, '') || null
    if (isBrandOwned(ch.channelTitle, handle, ch.url, ch.description)) {
      console.log(`[standalone-discovery] Static filter removed "${ch.channelTitle}"`)
      return false
    }
    return true
  })

  // Step 4b: LLM quality filter + category assignment — 1 AI call
  const llmResult = await llmChannelFilter(
    afterStatic.map(ch => ({
      channelTitle: ch.channelTitle,
      handle: ch.handle?.replace(/^@/, '') || null,
      description: ch.description,
      subscriberCount: ch.subscriberCount,
      anchorVideos: ch.anchorVideos,
    })),
    categoryNames
  )
  const filtered = afterStatic.filter(ch => !llmResult.rejected.has(ch.channelTitle))
  console.log(`[standalone-discovery] ${results.length} → ${afterStatic.length} (static) → ${filtered.length} (LLM) channels`)

  // Step 5: Batch dedup — 1 DB call
  const channelsWithHandles = filtered.map(ch => ({
    ch,
    handle: ch.handle?.replace(/^@/, '') || null,
  }))
  const allHandles = channelsWithHandles.map(c => c.handle).filter((h): h is string => !!h)
  const allUrls = channelsWithHandles.map(c => c.ch.url).filter(Boolean)

  const existingMap = new Map<string, string>()
  if (allHandles.length > 0 || allUrls.length > 0) {
    const handlePlaceholders = allHandles.map((_, i) => `LOWER($${i + 1})`).join(', ')
    const urlPlaceholders = allUrls.map((_, i) => `$${allHandles.length + i + 1}`).join(', ')
    const conditions: string[] = []
    if (allHandles.length > 0) conditions.push(`(platform = 'youtube' AND LOWER(handle) IN (${handlePlaceholders}))`)
    if (allUrls.length > 0) conditions.push(`url IN (${urlPlaceholders})`)
    const existingRes = await dbQuery<{ id: string; handle: string | null; url: string | null }>(
      `SELECT id, handle, url FROM ${t('creators')} WHERE ${conditions.join(' OR ')}`,
      [...allHandles, ...allUrls]
    )
    for (const row of existingRes.data) {
      if (row.handle) existingMap.set(row.handle.toLowerCase(), row.id)
      if (row.url) existingMap.set(row.url, row.id)
    }
  }

  const toInsert = channelsWithHandles.filter(({ ch, handle }) => {
    const key = (handle && existingMap.get(handle.toLowerCase())) || existingMap.get(ch.url)
    return !key
  })
  const alreadyExisted = channelsWithHandles.length - toInsert.length

  // Step 6: Batch insert — 1 DB call
  const now = new Date().toISOString()
  const categoryPairs: { creatorId: string; catName: string }[] = []
  let newInserted = 0

  if (toInsert.length > 0) {
    const newRows = toInsert.map(({ ch, handle }) => {
      const id = uuidv4()
      return { id, ch, handle }
    })
    await dbInsertMany(
      t('creators'),
      ['id', 'name', 'display_name', 'platform', 'handle', 'url', 'subscriber_count', 'discovered_via', 'created_at', 'updated_at'],
      newRows.map(r => [r.id, r.ch.channelTitle, r.ch.channelTitle, 'youtube', r.handle, r.ch.url, r.ch.subscriberCount, 'standalone_discovery', now, now]),
      'DO NOTHING'
    )
    for (const { id, ch } of newRows) {
      newInserted++
      const cats = llmResult.categories.get(ch.channelTitle)
      if (cats?.length) {
        categoryPairs.push(...cats.map(catName => ({ creatorId: id, catName })))
      }
    }
  }

  // Step 7: Tag categories — 1-3 DB calls
  if (categoryPairs.length > 0) {
    await batchTagCategories(categoryPairs)
  }

  return { searched: results.length, filtered: filtered.length, new_inserted: newInserted, already_existed: alreadyExisted }
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

      // Batch lookup: find all existing creators by platform+handle or URL in one query
      const handles = creatorUrls.map(cu => cu.handle?.toLowerCase()).filter(Boolean) as string[]
      const urls = creatorUrls.map(cu => cu.url).filter(Boolean) as string[]
      const gumshoeExistingMap = new Map<string, string>() // "platform:handle_lower" or url → id

      if (handles.length > 0 || urls.length > 0) {
        const hPlaceholders = handles.map((_, i) => `LOWER($${i + 1})`).join(', ')
        const uPlaceholders = urls.map((_, i) => `$${handles.length + i + 1}`).join(', ')
        const conditions: string[] = []
        if (handles.length > 0) conditions.push(`LOWER(handle) IN (${hPlaceholders})`)
        if (urls.length > 0) conditions.push(`url IN (${uPlaceholders})`)
        const existingRes = await dbQuery<{ id: string; platform: string; handle: string | null; url: string | null }>(
          `SELECT id, platform, handle, url FROM ${t('creators')} WHERE ${conditions.join(' OR ')}`,
          [...handles, ...urls]
        )
        for (const row of existingRes.data) {
          if (row.handle) gumshoeExistingMap.set(`${row.platform}:${row.handle.toLowerCase()}`, row.id)
          if (row.url) gumshoeExistingMap.set(row.url, row.id)
        }
      }

      // Assign IDs — insert new creators in batch
      const toInsert: typeof creatorUrls = []
      const insertedIds: string[] = []

      for (const cu of creatorUrls) {
        const existingId = gumshoeExistingMap.get(`${cu.platform}:${cu.handle?.toLowerCase()}`) || gumshoeExistingMap.get(cu.url) || null
        if (existingId) {
          gumshoeCreators.push({ id: existingId, name: cu.handle, platform: cu.platform, handle: cu.handle, source: 'gumshoe' })
        } else {
          const newId = uuidv4()
          insertedIds.push(newId)
          toInsert.push(cu)
          gumshoeCreators.push({ id: newId, name: cu.handle, platform: cu.platform, handle: cu.handle, source: 'gumshoe' })
        }
      }

      // Gumshoe does not insert new creators into the global network — only uses existing ones
      if (toInsert.length > 0) {
        console.log(`[discovery] Gumshoe: skipping global insert for ${toInsert.length} new creators (not in DB)`)
        // Remove the skipped creators from gumshoeCreators — they were added optimistically above
        const skippedIds = new Set(insertedIds)
        gumshoeCreators = gumshoeCreators.filter(gc => !skippedIds.has(gc.id))
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

  // Phase B2: Medium (rapid_research) + Dev.to (tag API) — run in parallel
  const [rrResult, devtoResult] = await Promise.all([
    discoverByRapidResearch(topics),
    discoverByDevtoTagSearch(topics),
  ])
  console.log(`[discovery] Phase B2: Medium ${rrResult.creators.length} (${rrResult.newInserted} new), Dev.to ${devtoResult.creators.length} (${devtoResult.newInserted} new)`)

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

  // Phase C: LLM look-alike discovery (supplementary to API search) — with overall timeout
  const llmResult = await Promise.race([
    discoverByLLM(campaign, seeds, options.llmCount || 20),
    new Promise<{ suggestions: MatchedCreator[]; newInserted: number; deduped: number; rejected: number }>(resolve =>
      setTimeout(() => {
        console.log('[discovery] LLM discovery phase timed out (90s), continuing with other results')
        resolve({ suggestions: [], newInserted: 0, deduped: 0, rejected: 0 })
      }, 90_000)
    ),
  ])

  // Link all discovered creators to campaign
  const allCreators = [...gumshoeCreators, ...dbMatched, ...ytSearchCreators, ...rrResult.creators, ...devtoResult.creators, ...llmResult.suggestions]
  const totalLinked = await linkCreatorsToCampaign(campaignId, userId, allCreators)

  // Log activity
  const result: DiscoveryResult = {
    db_matched: dbMatched.length,
    yt_search_found: ytSearchCreators.length,
    yt_search_new: ytSearchNew,
    rapid_research_found: rrResult.creators.length,
    rapid_research_new: rrResult.newInserted,
    devto_search_found: devtoResult.creators.length,
    devto_search_new: devtoResult.newInserted,
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
