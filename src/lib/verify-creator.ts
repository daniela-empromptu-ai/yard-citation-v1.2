/**
 * Verify LLM-suggested creators actually exist on the claimed platform
 * and have content relevant to the campaign topics.
 *
 * Catches two classes of errors:
 * 1. Fictional handles (don't exist at all)
 * 2. Wrong-person handles (exist but wrong identity, e.g. @angiejones → cooking channel)
 *
 * The relevance check is intentionally a LOW bar — it only rejects creators
 * whose content is clearly in a different domain (cooking, yoga, etc.).
 * Fine-grained relevance scoring happens later in the prequalify AI step.
 */

import { resolveChannelId, getChannelVideos } from '@/lib/youtube'
import { fetchDevtoArticles } from '@/lib/devto/api'
import { fetchMediumArticles } from '@/lib/medium/feed-parser'

export interface VerificationResult {
  verified: boolean
  realName?: string
  reason: string
}

interface CreatorToVerify {
  name: string
  platform: string
  handle: string
  url: string
  suggested_categories: string[]
}

/**
 * Extract meaningful keywords from topics and categories for fuzzy matching.
 * Splits multi-word phrases into individual words and filters out noise.
 */
function extractKeywords(topics: string[], categories: string[] = []): string[] {
  const STOP_WORDS = new Set([
    'the', 'a', 'an', 'and', 'or', 'for', 'in', 'on', 'of', 'to', 'with', 'by', 'is', 'at', 'as',
    'how', 'what', 'why', 'best', 'top', 'new', 'use', 'using', 'your', 'from',
  ])

  const allPhrases = [...topics, ...categories]
  const words = new Set<string>()

  for (const phrase of allPhrases) {
    // Keep the full phrase as a keyword (lowercased)
    const lower = phrase.toLowerCase().trim()
    if (lower.length >= 3) words.add(lower)

    // Also split into individual words
    for (const word of lower.split(/[\s\-_/,]+/)) {
      if (word.length >= 3 && !STOP_WORDS.has(word)) {
        words.add(word)
      }
    }
  }

  return Array.from(words)
}

/**
 * Check if content text has any keyword overlap. Returns the number of keyword hits.
 * Uses word-level matching: keyword "devops" matches anywhere in the text.
 */
function countKeywordHits(contentText: string, keywords: string[]): number {
  const lower = contentText.toLowerCase()
  return keywords.filter(kw => lower.includes(kw)).length
}

/**
 * Check that a creator handle exists on the platform and has relevant content.
 * Returns verified=true only if the handle exists AND content signals match.
 */
export async function verifyCreator(
  creator: CreatorToVerify,
  campaignTopics: string[]
): Promise<VerificationResult> {
  const handle = (creator.handle || '').replace(/^@/, '')
  if (!handle) return { verified: false, reason: 'No handle provided' }

  const keywords = extractKeywords(campaignTopics, creator.suggested_categories || [])

  try {
    switch (creator.platform) {
      case 'youtube':
        return await verifyYouTube(creator, handle, keywords)
      case 'devto':
        return await verifyDevto(handle, keywords)
      case 'medium':
        return await verifyMedium(handle, keywords)
      default:
        return { verified: false, reason: `Unsupported platform: ${creator.platform}` }
    }
  } catch (e) {
    console.log(`[verify] ${creator.platform}/${handle}: error — ${(e as Error).message}`)
    return { verified: false, reason: `Verification error: ${(e as Error).message}` }
  }
}

// ─── YouTube ───

async function verifyYouTube(
  creator: CreatorToVerify,
  handle: string,
  keywords: string[]
): Promise<VerificationResult> {
  const apiKey = process.env.YOUTUBE_API_KEY || ''
  const url = creator.url || `https://www.youtube.com/@${handle}`

  // Step 1: Does the channel exist?
  const resolution = await resolveChannelId(url, apiKey)
  if (!resolution.channelId) {
    return { verified: false, reason: `YouTube channel not found for @${handle}` }
  }

  // Step 2: Does it have videos?
  const videos = await getChannelVideos(resolution.channelId, 10)
  if (videos.length === 0) {
    return { verified: false, reason: `YouTube channel @${handle} has no videos` }
  }

  // Step 3: Do any video titles contain relevant keywords?
  const videoText = videos.map(v => v.title).join(' ')
  const hits = countKeywordHits(videoText, keywords)

  if (hits === 0) {
    const sampleTitles = videos.slice(0, 3).map(v => `"${v.title}"`).join(', ')
    return {
      verified: false,
      reason: `YouTube @${handle} exists but content doesn't match (0/${keywords.length} keywords). Videos: ${sampleTitles}`,
    }
  }

  console.log(`[verify] youtube/@${handle}: verified (${hits}/${keywords.length} keyword hits in ${videos.length} videos)`)
  return { verified: true, reason: 'Channel exists with relevant content' }
}

// ─── Dev.to ───

async function verifyDevto(
  handle: string,
  keywords: string[]
): Promise<VerificationResult> {
  const result = await fetchDevtoArticles(handle, 5)

  if (result.status === 'no_user') {
    return { verified: false, reason: `Dev.to user "${handle}" does not exist` }
  }

  if (result.status !== 'success' || result.articles.length === 0) {
    return { verified: false, reason: `Dev.to user "${handle}" has no articles` }
  }

  const allText = result.articles
    .map(a => `${a.title} ${a.tags.join(' ')}`)
    .join(' ')

  const hits = countKeywordHits(allText, keywords)

  if (hits === 0) {
    const sampleTitles = result.articles.slice(0, 3).map(a => `"${a.title}"`).join(', ')
    return {
      verified: false,
      reason: `Dev.to "${handle}" exists but content doesn't match (0/${keywords.length} keywords). Articles: ${sampleTitles}`,
    }
  }

  console.log(`[verify] devto/${handle}: verified (${hits}/${keywords.length} keyword hits)`)
  return { verified: true, reason: 'User exists with relevant content' }
}

// ─── Medium ───

async function verifyMedium(
  handle: string,
  keywords: string[]
): Promise<VerificationResult> {
  const result = await fetchMediumArticles(handle, 5)

  if (result.status === 'no_feed') {
    return { verified: false, reason: `Medium user "@${handle}" not found (no RSS feed)` }
  }

  if (result.status !== 'success' || result.articles.length === 0) {
    return { verified: false, reason: `Medium user "@${handle}" has no articles` }
  }

  const allText = result.articles.map(a => a.title).join(' ')
  const hits = countKeywordHits(allText, keywords)

  if (hits === 0) {
    const sampleTitles = result.articles.slice(0, 3).map(a => `"${a.title}"`).join(', ')
    return {
      verified: false,
      reason: `Medium "@${handle}" exists but content doesn't match (0/${keywords.length} keywords). Articles: ${sampleTitles}`,
    }
  }

  console.log(`[verify] medium/@${handle}: verified (${hits}/${keywords.length} keyword hits)`)
  return { verified: true, reason: 'User exists with relevant content' }
}
