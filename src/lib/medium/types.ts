/**
 * Type definitions for Medium article fetching.
 */

export interface MediumArticle {
  title: string
  url: string
  publishedAt: string
  /** Plain text extracted from HTML content */
  text: string
  wordCount: number
  categories: string[]
}

export type MediumFetchStatus =
  | 'success'
  | 'no_feed'
  | 'no_articles'
  | 'error'

export interface MediumFetchResult {
  handle: string
  status: MediumFetchStatus
  articles: MediumArticle[]
  error?: string
}
