/**
 * Fetch and parse Medium RSS feed for a given handle.
 * Feed URL: https://medium.com/feed/@{handle}
 *
 * Returns up to `limit` most recent articles with full text (non-paywalled).
 */

import { MediumArticle, MediumFetchResult } from './types'

/**
 * Strip HTML tags and decode common entities → plain text.
 */
function htmlToPlainText(html: string): string {
  return html
    // Remove CDATA wrappers
    .replace(/<!\[CDATA\[/g, '')
    .replace(/\]\]>/g, '')
    // Remove style/script blocks
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    // Block-level tags → newline
    .replace(/<\/(p|div|h[1-6]|li|blockquote|br\s*\/?)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    // Remove remaining tags
    .replace(/<[^>]+>/g, '')
    // Decode entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Collapse whitespace
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Parse a single <item> block from the RSS XML.
 */
function parseItem(itemXml: string): MediumArticle | null {
  const title = itemXml.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/)
    || itemXml.match(/<title>([\s\S]*?)<\/title>/)
  const link = itemXml.match(/<link>([\s\S]*?)<\/link>/)
  const pubDate = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/)
  const content = itemXml.match(/<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/)
    || itemXml.match(/<content:encoded>([\s\S]*?)<\/content:encoded>/)

  if (!title || !link) return null

  // Strip query params from URL (Medium appends ?source=rss-...)
  const cleanUrl = link[1].trim().split('?')[0]

  const text = content ? htmlToPlainText(content[1]) : ''
  const wordCount = text ? text.split(/\s+/).length : 0

  // Extract categories
  const categories: string[] = []
  const catRegex = /<category><!\[CDATA\[([\s\S]*?)\]\]><\/category>/g
  let catMatch
  while ((catMatch = catRegex.exec(itemXml)) !== null) {
    categories.push(catMatch[1].trim())
  }

  return {
    title: title[1].trim(),
    url: cleanUrl,
    publishedAt: pubDate ? new Date(pubDate[1].trim()).toISOString() : new Date().toISOString(),
    text,
    wordCount,
    categories,
  }
}

/**
 * Fetch recent articles from a Medium author's RSS feed.
 */
export async function fetchMediumArticles(
  handle: string,
  limit: number = 10
): Promise<MediumFetchResult> {
  const feedUrl = `https://medium.com/feed/@${encodeURIComponent(handle)}`

  try {
    const res = await fetch(feedUrl, { signal: AbortSignal.timeout(15000) })
    if (!res.ok) {
      return { handle, status: 'no_feed', articles: [], error: `HTTP ${res.status}` }
    }

    const xml = await res.text()

    // Extract all <item> blocks
    const items: string[] = []
    const itemRegex = /<item>([\s\S]*?)<\/item>/g
    let match
    while ((match = itemRegex.exec(xml)) !== null) {
      items.push(match[1])
    }

    if (items.length === 0) {
      return { handle, status: 'no_articles', articles: [] }
    }

    const articles: MediumArticle[] = []
    for (const itemXml of items.slice(0, limit)) {
      const article = parseItem(itemXml)
      if (article) articles.push(article)
    }

    if (articles.length === 0) {
      return { handle, status: 'no_articles', articles: [] }
    }

    return { handle, status: 'success', articles }
  } catch (e) {
    return { handle, status: 'error', articles: [], error: (e as Error).message }
  }
}
