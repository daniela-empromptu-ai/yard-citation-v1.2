/**
 * Type definitions for YouTube transcript fetching and channel resolution.
 */

export interface TranscriptSegment {
  text: string
  start: number
  duration: number
}

export interface TranscriptData {
  videoId: string
  language: string
  segments: TranscriptSegment[]
  fullText: string
}

export interface VideoInfo {
  videoId: string
  title: string
  publishedAt: string
  url: string
}

export interface ChannelResolution {
  channelId: string | null
  method: 'parsed' | 'api_handle' | 'failed'
  error?: string
  subscriberCount?: number
}

export type CreatorTranscriptStatus =
  | 'success'
  | 'no_youtube'
  | 'no_channel'
  | 'no_video'
  | 'no_transcript'
  | 'error'

export interface PerVideoTranscript {
  video: VideoInfo
  fullText: string
  language: string
}

export interface CreatorTranscriptResult {
  creatorId: string
  creatorName: string
  status: CreatorTranscriptStatus
  channelId?: string
  video?: VideoInfo
  videos?: VideoInfo[]
  transcript?: TranscriptData
  /** Individual transcript per video — used to create separate content_items so evidence links to the correct video */
  perVideoTranscripts?: PerVideoTranscript[]
  followerCount?: number
  topics?: string[]
  error?: string
  /** Latest video publish date from RSS — used for dormancy check instead of anchor video date */
  latestPublishDate?: string
}
