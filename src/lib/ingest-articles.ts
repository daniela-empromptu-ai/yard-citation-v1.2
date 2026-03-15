/**
 * Article ingestion pipeline for Medium and Dev.to creators.
 *
 * Given a list of creators with platform URLs, fetches their recent articles
 * and returns results in a format compatible with the prequalify pipeline.
 */

import { fetchMediumArticles, extractMediumHandle } from '@/lib/medium'
import { fetchDevtoArticles, extractDevtoUsername } from '@/lib/devto'

// ─── Types ───

export interface ArticleContent {
  title: string
  url: string
  publishedAt: string
  text: string
  wordCount: number
  tags: string[]
}

export type ArticleFetchStatus =
  | 'success'
  | 'no_handle'
  | 'no_articles'
  | 'unsupported_platform'
  | 'error'

export interface CreatorArticleResult {
  creatorId: string
  creatorName: string
  platform: string
  status: ArticleFetchStatus
  articles: ArticleContent[]
  /** Combined text from all articles (for AI scoring) */
  combinedText: string
  combinedWordCount: number
  followerCount?: number
  topics?: string[]
  error?: string
}

interface CreatorInput {
  creator_id: string
  creator_name: string
  platform: string
  platform_url: string | null
  follower_count: number | null
  topics: string[]
}

// ─── Fetcher ───

/**
 * Fetch articles for a single creator based on their platform.
 */
async function fetchArticlesForCreator(creator: CreatorInput): Promise<CreatorArticleResult> {
  const base: CreatorArticleResult = {
    creatorId: creator.creator_id,
    creatorName: creator.creator_name,
    platform: creator.platform,
    status: 'unsupported_platform',
    articles: [],
    combinedText: '',
    combinedWordCount: 0,
    followerCount: creator.follower_count ?? undefined,
    topics: creator.topics,
  }

  if (!creator.platform_url) {
    return { ...base, status: 'no_handle' }
  }

  if (creator.platform === 'medium') {
    const handle = extractMediumHandle(creator.platform_url)
    if (!handle) {
      return { ...base, status: 'no_handle', error: `Cannot extract Medium handle from: ${creator.platform_url}` }
    }

    console.log(`[ingest] ${creator.creator_name}: fetching Medium feed @${handle}`)
    const result = await fetchMediumArticles(handle, 10)

    if (result.status !== 'success' || result.articles.length === 0) {
      return { ...base, status: result.status === 'success' ? 'no_articles' : result.status as ArticleFetchStatus, error: result.error }
    }

    const articles: ArticleContent[] = result.articles.map(a => ({
      title: a.title,
      url: a.url,
      publishedAt: a.publishedAt,
      text: a.text,
      wordCount: a.wordCount,
      tags: a.categories,
    }))

    const combinedText = articles.map(a => `## ${a.title}\n\n${a.text}`).join('\n\n---\n\n')
    return {
      ...base,
      status: 'success',
      articles,
      combinedText,
      combinedWordCount: combinedText.split(/\s+/).length,
    }
  }

  if (creator.platform === 'devto') {
    const username = extractDevtoUsername(creator.platform_url)
    if (!username) {
      return { ...base, status: 'no_handle', error: `Cannot extract Dev.to username from: ${creator.platform_url}` }
    }

    console.log(`[ingest] ${creator.creator_name}: fetching Dev.to articles for ${username}`)
    const result = await fetchDevtoArticles(username, 10)

    if (result.status !== 'success' || result.articles.length === 0) {
      return { ...base, status: result.status === 'success' ? 'no_articles' : result.status as ArticleFetchStatus, error: result.error }
    }

    const articles: ArticleContent[] = result.articles.map(a => ({
      title: a.title,
      url: a.url,
      publishedAt: a.publishedAt,
      text: a.text,
      wordCount: a.wordCount,
      tags: a.tags,
    }))

    const combinedText = articles.map(a => `## ${a.title}\n\n${a.text}`).join('\n\n---\n\n')
    return {
      ...base,
      status: 'success',
      articles,
      combinedText,
      combinedWordCount: combinedText.split(/\s+/).length,
    }
  }

  return base
}

// ─── Pipeline ───

/**
 * Fetch articles for a batch of medium/devto creators.
 * Processes sequentially to respect rate limits.
 */
export async function fetchCreatorArticles(
  creators: CreatorInput[]
): Promise<CreatorArticleResult[]> {
  const results: CreatorArticleResult[] = []

  for (let i = 0; i < creators.length; i++) {
    const creator = creators[i]

    // Small delay between creators to respect rate limits
    if (i > 0) await new Promise(r => setTimeout(r, 1000))

    const result = await fetchArticlesForCreator(creator)
    results.push(result)

    console.log(`[ingest] ${creator.creator_name}: ${result.status} (${result.articles.length} articles, ${result.combinedWordCount} words)`)

    if ((i + 1) % 10 === 0) {
      console.log(`[ingest] Progress: ${i + 1}/${creators.length}`)
    }
  }

  console.log(`[ingest] Done: ${creators.length}/${creators.length}`)
  return results
}
