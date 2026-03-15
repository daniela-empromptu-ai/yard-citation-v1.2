/**
 * Type definitions for Dev.to article fetching.
 */

export interface DevtoArticle {
  id: number
  title: string
  url: string
  publishedAt: string
  /** Full markdown body */
  text: string
  wordCount: number
  tags: string[]
}

export type DevtoFetchStatus =
  | 'success'
  | 'no_user'
  | 'no_articles'
  | 'error'

export interface DevtoFetchResult {
  username: string
  status: DevtoFetchStatus
  articles: DevtoArticle[]
  error?: string
}
