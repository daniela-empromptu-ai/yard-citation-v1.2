/**
 * Fetch articles from Dev.to public REST API.
 *
 * List articles:  GET https://dev.to/api/articles?username={handle}&per_page=10
 * Full article:   GET https://dev.to/api/articles/{id}
 * Tag search:     GET https://dev.to/api/articles?tag={tag}&top=7&per_page=30
 *
 * Free, no auth needed, 30 req/min rate limit.
 */

import { DevtoArticle, DevtoFetchResult } from './types'

export interface DevtoAuthorResult {
  username: string
  name: string
  profile_url: string
}

/**
 * Search Dev.to for authors who write about the given topics using tag-based search.
 * Returns unique authors across all matched tags.
 */
export async function searchDevtoByTopics(topics: string[]): Promise<DevtoAuthorResult[]> {
  // Map topics to tag slugs: lowercase, strip spaces ("DevOps" → "devops")
  const tags = topics.map(t => t.toLowerCase().replace(/\s+/g, ''))
  const seen = new Set<string>()
  const authors: DevtoAuthorResult[] = []

  for (const tag of tags.slice(0, 4)) {
    try {
      const res = await fetch(
        `https://dev.to/api/articles?tag=${encodeURIComponent(tag)}&top=7&per_page=30`,
        { headers: { Accept: 'application/json', 'User-Agent': 'Yard-Creator-Discovery/1.0' }, signal: AbortSignal.timeout(10_000) }
      )
      if (!res.ok) continue
      const articles = await res.json() as Array<{ user: { username: string; name: string } }>
      for (const article of articles) {
        const { username, name } = article.user || {}
        if (username && !seen.has(username.toLowerCase())) {
          seen.add(username.toLowerCase())
          authors.push({ username, name: name || username, profile_url: `https://dev.to/${username}` })
        }
      }
    } catch {
      // swallow per-tag errors, continue with next tag
    }
  }

  return authors
}

interface DevtoListItem {
  id: number
  title: string
  url: string
  published_at: string
  tag_list: string[]
}

interface DevtoFullArticle {
  id: number
  title: string
  url: string
  published_at: string
  tag_list: string[]
  body_markdown: string
}

/**
 * Fetch recent articles from a Dev.to user, including full markdown body.
 */
export async function fetchDevtoArticles(
  username: string,
  limit: number = 10
): Promise<DevtoFetchResult> {
  const listUrl = `https://dev.to/api/articles?username=${encodeURIComponent(username)}&per_page=${limit}`

  try {
    const listRes = await fetch(listUrl, {
      signal: AbortSignal.timeout(15000),
      headers: { 'Accept': 'application/json' },
    })

    if (listRes.status === 404) {
      return { username, status: 'no_user', articles: [], error: 'User not found' }
    }
    if (!listRes.ok) {
      return { username, status: 'error', articles: [], error: `HTTP ${listRes.status}` }
    }

    const items: DevtoListItem[] = await listRes.json()

    if (items.length === 0) {
      return { username, status: 'no_articles', articles: [] }
    }

    // Fetch full body for each article (respecting rate limits)
    const articles: DevtoArticle[] = []
    for (let i = 0; i < items.length; i++) {
      const item = items[i]

      // Rate limit: ~2 req/s to stay well under 30/min
      if (i > 0) await new Promise(r => setTimeout(r, 500))

      try {
        const fullRes = await fetch(`https://dev.to/api/articles/${item.id}`, {
          signal: AbortSignal.timeout(10000),
          headers: { 'Accept': 'application/json' },
        })

        if (fullRes.ok) {
          const full: DevtoFullArticle = await fullRes.json()
          const text = full.body_markdown || ''
          articles.push({
            id: full.id,
            title: full.title,
            url: full.url,
            publishedAt: new Date(full.published_at).toISOString(),
            text,
            wordCount: text.split(/\s+/).length,
            tags: full.tag_list || [],
          })
        } else {
          // Fallback: use list data without full body
          articles.push({
            id: item.id,
            title: item.title,
            url: item.url,
            publishedAt: new Date(item.published_at).toISOString(),
            text: '',
            wordCount: 0,
            tags: item.tag_list || [],
          })
        }
      } catch {
        // Fallback to list data
        articles.push({
          id: item.id,
          title: item.title,
          url: item.url,
          publishedAt: new Date(item.published_at).toISOString(),
          text: '',
          wordCount: 0,
          tags: item.tag_list || [],
        })
      }
    }

    return { username, status: 'success', articles }
  } catch (e) {
    return { username, status: 'error', articles: [], error: (e as Error).message }
  }
}
