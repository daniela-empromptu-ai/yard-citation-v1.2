/**
 * Get videos from a YouTube channel via free RSS feed.
 * No API key required.
 */

import { VideoInfo } from './types'

/**
 * Fetch up to `limit` videos from a YouTube channel's RSS feed.
 * Returns newest-first (RSS default order).
 */
export async function getChannelVideos(channelId: string, limit = 15): Promise<VideoInfo[]> {
  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`

  try {
    const res = await fetch(feedUrl, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return []

    const xml = await res.text()

    const videos: VideoInfo[] = []
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g
    let match: RegExpExecArray | null

    while ((match = entryRegex.exec(xml)) !== null && videos.length < limit) {
      const entry = match[1]

      const videoIdMatch = entry.match(/<yt:videoId>([\s\S]*?)<\/yt:videoId>/)
      const titleMatch = entry.match(/<title>([\s\S]*?)<\/title>/)
      const publishedMatch = entry.match(/<published>([\s\S]*?)<\/published>/)

      if (!videoIdMatch) continue

      const videoId = videoIdMatch[1].trim()
      const title = titleMatch ? titleMatch[1].trim() : 'Untitled'
      const publishedAt = publishedMatch ? publishedMatch[1].trim() : new Date().toISOString()

      videos.push({
        videoId,
        title,
        publishedAt,
        url: `https://www.youtube.com/watch?v=${videoId}`,
      })
    }

    return videos
  } catch {
    return []
  }
}

/**
 * Fetch the latest video from a YouTube channel's RSS feed.
 * Returns null if the feed is empty or unavailable.
 */
export async function getLatestVideo(channelId: string): Promise<VideoInfo | null> {
  const videos = await getChannelVideos(channelId, 1)
  return videos[0] || null
}

/**
 * Rank videos by relevance to campaign topics.
 * Uses keyword substring matching on titles with full-phrase bonus and recency tiebreaker.
 * Pure computation, zero API cost.
 */
export function rankVideosByRelevance(videos: VideoInfo[], topics: string[]): VideoInfo[] {
  if (videos.length === 0 || topics.length === 0) return videos

  const topicsLower = topics.map(t => t.toLowerCase())

  const scored = videos.map(video => {
    const titleLower = video.title.toLowerCase()
    let score = 0

    for (const topic of topicsLower) {
      // Full phrase match bonus
      if (titleLower.includes(topic)) {
        score += 10
        continue
      }
      // Individual keyword match
      const words = topic.split(/\s+/)
      for (const word of words) {
        if (word.length >= 3 && titleLower.includes(word)) {
          score += 3
        }
      }
    }

    // Recency tiebreaker: newer videos get a small boost (0-2 points)
    const ageMs = Date.now() - new Date(video.publishedAt).getTime()
    const ageDays = ageMs / (1000 * 60 * 60 * 24)
    score += Math.max(0, 2 - ageDays / 180) // 2 pts if today, 0 pts if 1yr+

    return { video, score }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored.map(s => s.video)
}
