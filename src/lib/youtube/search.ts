/**
 * YouTube Data API search — find channels by keyword.
 *
 * Uses search.list (100 units per call) to find channels matching campaign search terms.
 * Returns real channel data: handle, subscriber count, description, recent videos.
 *
 * Quota costs (YouTube Data API v3, daily quota = 10,000 units):
 *   search.list = 100 units per call
 *   channels.list = 1 unit per call
 * Budget: ~50 search calls + 50 channel lookups per day = ~5,050 units
 */

export interface YouTubeSearchResult {
  channelId: string
  channelTitle: string
  handle: string | null
  description: string
  subscriberCount: number | null
  videoCount: number | null
  thumbnailUrl: string | null
  url: string
}

interface SearchItem {
  id: { channelId: string }
  snippet: {
    channelId: string
    title: string
    description: string
    thumbnails?: { default?: { url: string } }
  }
}

interface ChannelItem {
  id: string
  snippet: {
    title: string
    description: string
    customUrl?: string
  }
  statistics: {
    subscriberCount?: string
    videoCount?: string
    viewCount?: string
  }
}

/**
 * Search YouTube for channels matching a query term.
 * Returns up to `maxResults` channels per query.
 *
 * Cost: 100 API units per call + 1 unit per channel detail lookup.
 */
export async function searchYouTubeChannels(
  query: string,
  apiKey: string,
  maxResults = 5
): Promise<YouTubeSearchResult[]> {
  // Step 1: Search for channels (100 units)
  const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search')
  searchUrl.searchParams.set('part', 'snippet')
  searchUrl.searchParams.set('q', query)
  searchUrl.searchParams.set('type', 'channel')
  searchUrl.searchParams.set('maxResults', String(maxResults))
  searchUrl.searchParams.set('relevanceLanguage', 'en')
  searchUrl.searchParams.set('key', apiKey)

  const searchRes = await fetch(searchUrl.toString(), { signal: AbortSignal.timeout(10000) })
  if (!searchRes.ok) {
    const text = await searchRes.text()
    throw new Error(`YouTube search failed (${searchRes.status}): ${text.slice(0, 200)}`)
  }

  const searchData = await searchRes.json()
  const items: SearchItem[] = searchData.items || []

  if (items.length === 0) return []

  // Step 2: Get channel details (subscriber count, handle) — 1 unit per batch
  const channelIds = items.map(i => i.id.channelId || i.snippet.channelId).filter(Boolean)
  const details = await getChannelDetails(channelIds, apiKey)

  // Merge search results with channel details
  return items.map(item => {
    const channelId = item.id.channelId || item.snippet.channelId
    const detail = details.get(channelId)

    return {
      channelId,
      channelTitle: detail?.snippet.title || item.snippet.title,
      handle: detail?.snippet.customUrl || null,
      description: detail?.snippet.description || item.snippet.description,
      subscriberCount: detail?.statistics.subscriberCount
        ? parseInt(detail.statistics.subscriberCount, 10)
        : null,
      videoCount: detail?.statistics.videoCount
        ? parseInt(detail.statistics.videoCount, 10)
        : null,
      thumbnailUrl: item.snippet.thumbnails?.default?.url || null,
      url: detail?.snippet.customUrl
        ? `https://www.youtube.com/${detail.snippet.customUrl}`
        : `https://www.youtube.com/channel/${channelId}`,
    }
  })
}

/**
 * Batch fetch channel details (statistics + snippet).
 * Up to 50 channel IDs per call (1 API unit).
 */
async function getChannelDetails(
  channelIds: string[],
  apiKey: string
): Promise<Map<string, ChannelItem>> {
  const map = new Map<string, ChannelItem>()
  if (channelIds.length === 0) return map

  const url = new URL('https://www.googleapis.com/youtube/v3/channels')
  url.searchParams.set('part', 'snippet,statistics')
  url.searchParams.set('id', channelIds.join(','))
  url.searchParams.set('key', apiKey)

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) })
  if (!res.ok) return map

  const data = await res.json()
  for (const item of (data.items || []) as ChannelItem[]) {
    map.set(item.id, item)
  }
  return map
}

/**
 * Search for YouTube channels across multiple search terms.
 * Deduplicates by channel ID, returns unique channels sorted by subscriber count.
 *
 * Cost: ~100 units per term + 1 unit for channel details batch.
 */
export async function searchYouTubeChannelsByTerms(
  terms: string[],
  apiKey: string,
  options: {
    resultsPerTerm?: number
    maxTotal?: number
    minSubscribers?: number
  } = {}
): Promise<YouTubeSearchResult[]> {
  const { resultsPerTerm = 3, maxTotal = 30, minSubscribers = 500 } = options

  const seen = new Set<string>()
  const allResults: YouTubeSearchResult[] = []

  for (const term of terms) {
    try {
      const results = await searchYouTubeChannels(term, apiKey, resultsPerTerm)
      for (const r of results) {
        if (seen.has(r.channelId)) continue
        seen.add(r.channelId)

        // Filter out tiny channels
        if (r.subscriberCount !== null && r.subscriberCount < minSubscribers) continue

        allResults.push(r)
      }
    } catch (e) {
      console.error(`[yt-search] Search failed for "${term}":`, (e as Error).message)
    }

    if (allResults.length >= maxTotal) break
  }

  // Sort by subscriber count descending (null last)
  allResults.sort((a, b) => (b.subscriberCount || 0) - (a.subscriberCount || 0))

  return allResults.slice(0, maxTotal)
}
