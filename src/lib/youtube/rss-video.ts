/**
 * Get the latest video from a YouTube channel via free RSS feed.
 * No API key required.
 */

import { VideoInfo } from './types'

/**
 * Fetch the latest video from a YouTube channel's RSS feed.
 * Returns null if the feed is empty or unavailable.
 */
export async function getLatestVideo(channelId: string): Promise<VideoInfo | null> {
  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`

  try {
    const res = await fetch(feedUrl, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return null

    const xml = await res.text()

    // Parse first <entry> from Atom feed
    const entryMatch = xml.match(/<entry>([\s\S]*?)<\/entry>/)
    if (!entryMatch) return null

    const entry = entryMatch[1]

    const videoIdMatch = entry.match(/<yt:videoId>([\s\S]*?)<\/yt:videoId>/)
    const titleMatch = entry.match(/<title>([\s\S]*?)<\/title>/)
    const publishedMatch = entry.match(/<published>([\s\S]*?)<\/published>/)

    if (!videoIdMatch) return null

    const videoId = videoIdMatch[1].trim()
    const title = titleMatch ? titleMatch[1].trim() : 'Untitled'
    const publishedAt = publishedMatch ? publishedMatch[1].trim() : new Date().toISOString()

    return {
      videoId,
      title,
      publishedAt,
      url: `https://www.youtube.com/watch?v=${videoId}`,
    }
  } catch {
    return null
  }
}
