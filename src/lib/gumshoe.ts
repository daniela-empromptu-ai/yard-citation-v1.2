/**
 * Gumshoe API client: extract citation URLs from Gumshoe reports.
 *
 * API base: https://app.gumshoe.ai/v1
 * Report URL format: https://app.gumshoe.ai/r/{brand}/{key}/{id}
 * Requires GUMSHOE_API_KEY env var. Graceful on all failures — logs errors, returns empty.
 */

// ─── Types ───

export interface GumshoeCreatorUrl {
  url: string
  platform: 'youtube' | 'medium' | 'devto'
  handle: string
}

interface GumshoeRawResponse {
  personas?: Array<{
    questions?: Array<{
      answers?: Array<{
        citations?: Array<{ id: number; url: string; domain: string }>
      }>
    }>
  }>
}

interface GumshoeLatestRunResponse {
  data?: {
    run?: { ordinal: number }
  }
}

// ─── URL Parsing ───

/**
 * Extract report ID from a Gumshoe report URL.
 * Supports: https://app.gumshoe.ai/r/{brand}/{key}/{id}
 */
export function parseGumshoeUrl(url: string): string | null {
  try {
    // Match /r/brand/key/12345 pattern
    const match = url.match(/gumshoe\.ai\/r\/[^/]+\/[^/]+\/(\d+)/)
    return match ? match[1] : null
  } catch {
    return null
  }
}

// ─── API Calls ───

const GUMSHOE_BASE = 'https://app.gumshoe.ai/v1'

function getApiKey(): string | null {
  return process.env.GUMSHOE_API_KEY || null
}

async function gumshoeGet<T>(path: string): Promise<T | null> {
  const apiKey = getApiKey()
  if (!apiKey) return null

  try {
    const res = await fetch(`${GUMSHOE_BASE}${path}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) {
      console.log(`[gumshoe] API ${res.status} for ${path}`)
      return null
    }
    return await res.json() as T
  } catch (e) {
    console.log(`[gumshoe] API error for ${path}: ${(e as Error).message}`)
    return null
  }
}

/**
 * Fetch the latest run for a Gumshoe report.
 * Response: { data: { run: { ordinal: 1, ... } } }
 */
export async function fetchGumshoeLatestRun(reportId: string): Promise<{ ordinal: number } | null> {
  const res = await gumshoeGet<GumshoeLatestRunResponse>(`/reports/${reportId}/runs/latest`)
  if (!res?.data?.run?.ordinal) return null
  return { ordinal: res.data.run.ordinal }
}

/**
 * Fetch raw report data and extract all citations from personas → questions → answers.
 */
export async function fetchGumshoeCitations(
  reportId: string,
  ordinal: number
): Promise<Array<{ url: string; domain: string }>> {
  const data = await gumshoeGet<GumshoeRawResponse>(
    `/reports/${reportId}/runs/${ordinal}/raw`
  )
  if (!data?.personas) return []

  const citations: Array<{ url: string; domain: string }> = []
  for (const persona of data.personas) {
    for (const question of persona.questions || []) {
      for (const answer of question.answers || []) {
        for (const citation of answer.citations || []) {
          if (citation.url) {
            citations.push({ url: citation.url, domain: citation.domain || '' })
          }
        }
      }
    }
  }

  return citations
}

// ─── YouTube oEmbed: resolve watch URL → channel handle ───

/**
 * Extract video ID from a YouTube watch URL.
 */
function extractVideoId(url: string): string | null {
  const match = url.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/)
    || url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/)
  return match ? match[1] : null
}

/**
 * Resolve a YouTube watch URL to a channel handle via the free oEmbed API.
 * Returns { handle, channelUrl } or null on failure.
 */
async function resolveYouTubeHandle(watchUrl: string): Promise<{ handle: string; channelUrl: string } | null> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) return null
    const data = await res.json() as { author_url?: string; author_name?: string }
    if (!data.author_url) return null

    // author_url is like "https://www.youtube.com/@handle"
    const handleMatch = data.author_url.match(/youtube\.com\/@([a-zA-Z0-9_-]+)/)
    if (!handleMatch) return null

    return { handle: handleMatch[1], channelUrl: data.author_url }
  } catch {
    return null
  }
}

// ─── Creator URL Extraction ───

const MEDIUM_HANDLE_RE = /medium\.com\/@([a-zA-Z0-9_.-]+)/
const DEVTO_HANDLE_RE = /dev\.to\/([a-zA-Z0-9_-]+)/
const YT_CHANNEL_RE = /youtube\.com\/(@[a-zA-Z0-9_-]+|channel\/[a-zA-Z0-9_-]+|c\/[a-zA-Z0-9_-]+|user\/[a-zA-Z0-9_-]+)/

const SKIP_HANDLES = new Set(['tag', 'topic', 'search', 't', 'tags', 'settings', 'about', 'policy', 'tos'])

/**
 * Extract creator URLs from Gumshoe citations, filtering for supported platforms.
 * Deduplicates by platform+handle. Skips vertexaisearch redirect URLs.
 * Resolves YouTube watch URLs → channel handles via free oEmbed API.
 */
export async function extractCreatorUrls(citations: Array<{ url: string; domain?: string }>): Promise<GumshoeCreatorUrl[]> {
  const seen = new Set<string>()
  const results: GumshoeCreatorUrl[] = []

  // Collect YouTube watch URLs that need oEmbed resolution
  const ytWatchUrls: string[] = []

  for (const citation of citations) {
    if (!citation.url) continue
    if (citation.url.includes('vertexaisearch.cloud.google.com')) continue

    // ── YouTube channel URLs (direct match) ──
    const ytChannelMatch = citation.url.match(YT_CHANNEL_RE)
    if (ytChannelMatch) {
      const handle = ytChannelMatch[1].replace(/^(channel\/|c\/|user\/)/, '').toLowerCase()
      if (!SKIP_HANDLES.has(handle)) {
        const key = `youtube:${handle}`
        if (!seen.has(key)) {
          seen.add(key)
          results.push({
            url: `https://www.youtube.com/${handle.startsWith('@') ? handle : '@' + handle}`,
            platform: 'youtube',
            handle,
          })
        }
      }
      continue
    }

    // ── YouTube watch URLs → queue for oEmbed ──
    if (extractVideoId(citation.url)) {
      ytWatchUrls.push(citation.url)
      continue
    }

    // ── Medium ──
    const mediumMatch = citation.url.match(MEDIUM_HANDLE_RE)
    if (mediumMatch) {
      const handle = mediumMatch[1].toLowerCase()
      if (!SKIP_HANDLES.has(handle)) {
        const key = `medium:${handle}`
        if (!seen.has(key)) {
          seen.add(key)
          results.push({ url: `https://medium.com/@${handle}`, platform: 'medium', handle })
        }
      }
      continue
    }

    // ── Dev.to ──
    const devtoMatch = citation.url.match(DEVTO_HANDLE_RE)
    if (devtoMatch) {
      const handle = devtoMatch[1].toLowerCase()
      if (!SKIP_HANDLES.has(handle)) {
        const key = `devto:${handle}`
        if (!seen.has(key)) {
          seen.add(key)
          results.push({ url: `https://dev.to/${handle}`, platform: 'devto', handle })
        }
      }
      continue
    }
  }

  // ── Resolve YouTube watch URLs via oEmbed (batch, with dedup) ──
  // Dedup by video ID first to avoid redundant oEmbed calls
  const uniqueWatchUrls = new Map<string, string>()
  for (const url of ytWatchUrls) {
    const vid = extractVideoId(url)
    if (vid && !uniqueWatchUrls.has(vid)) {
      uniqueWatchUrls.set(vid, url)
    }
  }

  console.log(`[gumshoe] Resolving ${uniqueWatchUrls.size} unique YouTube watch URLs via oEmbed`)

  // Resolve in parallel batches of 5 to avoid hammering the endpoint
  const watchEntries = Array.from(uniqueWatchUrls.values())
  for (let i = 0; i < watchEntries.length; i += 5) {
    const batch = watchEntries.slice(i, i + 5)
    const resolved = await Promise.all(batch.map(url => resolveYouTubeHandle(url)))
    for (const result of resolved) {
      if (!result) continue
      const handle = result.handle.toLowerCase()
      const key = `youtube:${handle}`
      if (!seen.has(key)) {
        seen.add(key)
        results.push({
          url: result.channelUrl,
          platform: 'youtube',
          handle,
        })
      }
    }
    // Small delay between batches
    if (i + 5 < watchEntries.length) {
      await new Promise(r => setTimeout(r, 300))
    }
  }

  return results
}

// ─── High-level: Full extraction pipeline ───

/**
 * Given a Gumshoe report URL, fetch all citation creator URLs.
 * Returns empty array on any failure. Never throws.
 */
export async function extractCreatorsFromReport(reportUrl: string): Promise<GumshoeCreatorUrl[]> {
  try {
    const reportId = parseGumshoeUrl(reportUrl)
    if (!reportId) {
      console.log('[gumshoe] Could not parse report URL:', reportUrl)
      return []
    }

    const latestRun = await fetchGumshoeLatestRun(reportId)
    if (!latestRun) {
      console.log('[gumshoe] No runs found for report:', reportId)
      return []
    }

    const citations = await fetchGumshoeCitations(reportId, latestRun.ordinal)
    if (citations.length === 0) {
      console.log('[gumshoe] No citations in report run:', reportId)
      return []
    }

    const creatorUrls = await extractCreatorUrls(citations)
    console.log(`[gumshoe] Extracted ${creatorUrls.length} creator URLs from ${citations.length} citations`)
    return creatorUrls
  } catch (e) {
    console.log(`[gumshoe] Error extracting creators: ${(e as Error).message}`)
    return []
  }
}
