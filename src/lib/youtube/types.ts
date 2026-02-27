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
}

export type CreatorTranscriptStatus =
  | 'success'
  | 'no_youtube'
  | 'no_channel'
  | 'no_video'
  | 'no_transcript'
  | 'error'

export interface CreatorTranscriptResult {
  creatorId: string
  creatorName: string
  status: CreatorTranscriptStatus
  channelId?: string
  video?: VideoInfo
  transcript?: TranscriptData
  followerCount?: number
  topics?: string[]
  error?: string
}
