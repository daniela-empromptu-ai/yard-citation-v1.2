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

  // Batch in groups of 50 (YouTube API limit)
  for (let i = 0; i < channelIds.length; i += 50) {
    const batch = channelIds.slice(i, i + 50)
    const url = new URL('https://www.googleapis.com/youtube/v3/channels')
    url.searchParams.set('part', 'snippet,statistics')
    url.searchParams.set('id', batch.join(','))
    url.searchParams.set('key', apiKey)

    try {
      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) })
      if (!res.ok) {
        console.log(`[yt-search] Channel details batch failed: ${res.status}`)
        continue
      }

      const data = await res.json()
      for (const item of (data.items || []) as ChannelItem[]) {
        map.set(item.id, item)
      }
    } catch (e) {
      console.log(`[yt-search] Channel details batch error: ${(e as Error).message}`)
    }
  }

  console.log(`[yt-search] Channel details: ${map.size}/${channelIds.length} resolved`)
  return map
}

// ─── Per-Channel Video Search ───

export interface ChannelVideoResult {
  videoId: string
  title: string
  publishedAt: string
  channelId: string
  channelTitle: string
  thumbnailUrl: string | null
}

/**
 * Search for videos within a specific channel matching a query.
 * Uses search.list with channelId filter (100 API units per call).
 * This is Jack's workflow: find topic-relevant videos within a creator's channel.
 */
export async function searchChannelVideos(
  channelId: string,
  query: string,
  apiKey: string,
  options: { maxResults?: number; publishedAfter?: string } = {}
): Promise<ChannelVideoResult[]> {
  const { maxResults = 3, publishedAfter } = options

  const url = new URL('https://www.googleapis.com/youtube/v3/search')
  url.searchParams.set('part', 'snippet')
  url.searchParams.set('channelId', channelId)
  url.searchParams.set('q', query)
  url.searchParams.set('type', 'video')
  url.searchParams.set('order', 'relevance')
  url.searchParams.set('maxResults', String(maxResults))
  url.searchParams.set('key', apiKey)
  if (publishedAfter) {
    url.searchParams.set('publishedAfter', publishedAfter)
  }

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`YouTube channel video search failed (${res.status}): ${text.slice(0, 200)}`)
  }

  const data = await res.json()
  const items = (data.items || []) as Array<{
    id: { videoId: string }
    snippet: {
      title: string
      publishedAt: string
      channelId: string
      channelTitle: string
      thumbnails?: { default?: { url: string } }
    }
  }>

  return items.map(item => ({
    videoId: item.id.videoId,
    title: item.snippet.title,
    publishedAt: item.snippet.publishedAt,
    channelId: item.snippet.channelId,
    channelTitle: item.snippet.channelTitle,
    thumbnailUrl: item.snippet.thumbnails?.default?.url || null,
  }))
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

// ─── Video-Based Discovery Search ───

export interface VideoDiscoveryResult {
  channelId: string
  channelTitle: string
  handle: string | null
  description: string
  subscriberCount: number | null
  videoCount: number | null
  url: string
  /** The videos found during discovery — these are already known to be relevant */
  anchorVideos: { videoId: string; title: string; publishedAt: string }[]
}

/**
 * Search YouTube for VIDEOS matching search terms, then extract unique channels.
 * This finds creators through their content, not their channel name.
 * Each channel comes with its relevant "anchor videos" already attached.
 *
 * Cost: ~100 units per term + 1 unit for channel details batch.
 */
export async function searchYouTubeVideosByTerms(
  terms: string[],
  apiKey: string,
  options: {
    resultsPerTerm?: number
    maxChannels?: number
    minSubscribers?: number
  } = {}
): Promise<VideoDiscoveryResult[]> {
  const { resultsPerTerm = 5, maxChannels = 30, minSubscribers = 500 } = options

  // Collect all video results, grouped by channel
  const channelVideos = new Map<string, { videoId: string; title: string; publishedAt: string }[]>()
  const channelTitles = new Map<string, string>()

  for (const term of terms) {
    try {
      const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search')
      searchUrl.searchParams.set('part', 'snippet')
      searchUrl.searchParams.set('q', term)
      searchUrl.searchParams.set('type', 'video')
      searchUrl.searchParams.set('order', 'relevance')
      searchUrl.searchParams.set('maxResults', String(resultsPerTerm))
      searchUrl.searchParams.set('relevanceLanguage', 'en')
      searchUrl.searchParams.set('key', apiKey)

      const res = await fetch(searchUrl.toString(), { signal: AbortSignal.timeout(10000) })
      if (!res.ok) {
        console.error(`[yt-search] Video search failed for "${term}": ${res.status}`)
        continue
      }

      const data = await res.json()
      const items = (data.items || []) as Array<{
        id: { videoId: string }
        snippet: {
          channelId: string
          channelTitle: string
          title: string
          publishedAt: string
        }
      }>

      for (const item of items) {
        const chId = item.snippet.channelId
        channelTitles.set(chId, item.snippet.channelTitle)

        const videos = channelVideos.get(chId) || []
        // Avoid duplicate videos from different search terms
        if (!videos.some(v => v.videoId === item.id.videoId)) {
          videos.push({
            videoId: item.id.videoId,
            title: item.snippet.title,
            publishedAt: item.snippet.publishedAt,
          })
        }
        channelVideos.set(chId, videos)
      }
    } catch (e) {
      console.error(`[yt-search] Video search failed for "${term}":`, (e as Error).message)
    }

    if (channelVideos.size >= maxChannels * 2) break // rough cap, will filter below
  }

  if (channelVideos.size === 0) return []

  // Fetch channel details for all unique channels (1 API unit per batch of 50)
  const allChannelIds = Array.from(channelVideos.keys())
  const details = await getChannelDetails(allChannelIds, apiKey)

  // Build results, filter by subscriber count
  const results: VideoDiscoveryResult[] = []
  const channelEntries = Array.from(channelVideos.entries())
  for (const [channelId, videos] of channelEntries) {
    const detail = details.get(channelId)
    const subCount = detail?.statistics.subscriberCount
      ? parseInt(detail.statistics.subscriberCount, 10)
      : null

    if (subCount !== null && subCount < minSubscribers) continue

    results.push({
      channelId,
      channelTitle: detail?.snippet.title || channelTitles.get(channelId) || '',
      handle: detail?.snippet.customUrl || null,
      description: detail?.snippet.description || '',
      subscriberCount: subCount,
      videoCount: detail?.statistics.videoCount ? parseInt(detail.statistics.videoCount, 10) : null,
      url: detail?.snippet.customUrl
        ? `https://www.youtube.com/${detail.snippet.customUrl}`
        : `https://www.youtube.com/channel/${channelId}`,
      anchorVideos: videos,
    })
  }

  // Sort by number of anchor videos (more = more relevant), then subscriber count
  results.sort((a, b) => {
    if (b.anchorVideos.length !== a.anchorVideos.length) return b.anchorVideos.length - a.anchorVideos.length
    return (b.subscriberCount || 0) - (a.subscriberCount || 0)
  })

  return results.slice(0, maxChannels)
}
