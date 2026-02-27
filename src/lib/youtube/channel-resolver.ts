/**
 * Resolve YouTube channel IDs from creator platform URLs.
 * Tier 0: Parse /channel/UC... directly from URL (free).
 * Tier 1: Use channels.list?forHandle for @handle URLs (1 API unit).
 * No search fallback — skip creator if both tiers fail.
 */

import { ChannelResolution } from './types'

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
 */
async function resolveHandleViaApi(handle: string, apiKey: string): Promise<string | null> {
  const url = `https://www.googleapis.com/youtube/v3/channels?forHandle=${encodeURIComponent(handle)}&part=id&key=${apiKey}`
  const res = await fetch(url)
  if (!res.ok) return null

  const data = await res.json()
  if (data.items && data.items.length > 0) {
    return data.items[0].id
  }
  return null
}

/**
 * Resolve a YouTube channel ID from a platform URL.
 * Returns channel ID and the method used.
 */
export async function resolveChannelId(
  platformUrl: string,
  apiKey: string
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
      const channelId = await resolveHandleViaApi(handle, apiKey)
      if (channelId) {
        return { channelId, method: 'api_handle' }
      }
    } catch (e) {
      return { channelId: null, method: 'failed', error: (e as Error).message }
    }
  }

  return { channelId: null, method: 'failed', error: 'Could not parse channel ID or handle from URL' }
}
