/**
 * Resolve YouTube channel IDs from creator platform URLs.
 * Tier 0: Parse /channel/UC... directly from URL (free).
 * Tier 1: Use channels.list?forHandle for @handle URLs (1 API unit).
 * No search fallback — skip creator if both tiers fail.
 */

import { ChannelResolution } from './types'
import { getYouTubeKey, reportQuotaExhausted, isQuotaExceeded } from './api-key'

const CHANNEL_ID_RE = /\/channel\/(UC[\w-]{22})/
const HANDLE_RE = /\/@([\w.-]+)/
const CUSTOM_URL_RE = /\/c\/([\w.-]+)/
const USER_RE = /\/user\/([\w.-]+)/

/**
 * Extract channel ID directly from URL if it contains /channel/UC...
 */
function parseChannelIdFromUrl(url: string): string | null {
  const match = url.match(CHANNEL_ID_RE)
  return match ? match[1] : null
}

/**
 * Extract handle from /@handle URL format
 */
function parseHandleFromUrl(url: string): string | null {
  const handleMatch = url.match(HANDLE_RE)
  if (handleMatch) return handleMatch[1]

  const customMatch = url.match(CUSTOM_URL_RE)
  if (customMatch) return customMatch[1]

  const userMatch = url.match(USER_RE)
  if (userMatch) return userMatch[1]

  return null
}

/**
 * Resolve channel ID via YouTube Data API channels.list (1 unit).
 * Also fetches subscriberCount from statistics — same call, no extra quota.
 */
async function resolveHandleViaApi(handle: string): Promise<{ channelId: string; subscriberCount?: number } | null> {
  const buildUrl = (key: string) =>
    `https://www.googleapis.com/youtube/v3/channels?forHandle=${encodeURIComponent(handle)}&part=id,statistics&key=${key}`
  let res = await fetch(buildUrl(getYouTubeKey()))
  if (res.status === 403) {
    const body = await res.clone().json().catch(() => ({}))
    if (isQuotaExceeded(res.status, body) && reportQuotaExhausted('resolveHandleViaApi')) {
      res = await fetch(buildUrl(getYouTubeKey()))
    }
  }
  if (!res.ok) return null

  const data = await res.json()
  if (data.items && data.items.length > 0) {
    const item = data.items[0]
    const subscriberCount = item.statistics?.subscriberCount
      ? parseInt(item.statistics.subscriberCount, 10)
      : undefined
    return { channelId: item.id, subscriberCount }
  }
  return null
}

/**
 * Resolve a YouTube channel ID from a platform URL.
 * Returns channel ID and the method used.
 */
export async function resolveChannelId(
  platformUrl: string,
  _apiKey?: string
): Promise<ChannelResolution> {
  // Tier 0: Direct parse
  const directId = parseChannelIdFromUrl(platformUrl)
  if (directId) {
    return { channelId: directId, method: 'parsed' }
  }

  // Tier 1: Handle lookup via API
  const handle = parseHandleFromUrl(platformUrl)
  if (handle) {
    try {
      const resolved = await resolveHandleViaApi(handle)
      if (resolved) {
        return { channelId: resolved.channelId, method: 'api_handle', subscriberCount: resolved.subscriberCount }
      }
      return { channelId: null, method: 'failed', error: `No YouTube channel found for handle @${handle}` }
    } catch (e) {
      return { channelId: null, method: 'failed', error: `YouTube API error for @${handle}: ${(e as Error).message}` }
    }
  }

  return { channelId: null, method: 'failed', error: `Could not parse channel ID or handle from URL: ${platformUrl}` }
}
