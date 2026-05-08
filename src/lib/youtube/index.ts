export { resolveChannelId } from './channel-resolver'
export { getLatestVideo, getChannelVideos, rankVideosByRelevance } from './rss-video'
export { buildTranscriptFromTimedText } from './transcript'
export { searchYouTubeChannels, searchYouTubeChannelsByTerms, searchChannelVideos, searchYouTubeVideosByTerms } from './search'
export type { ChannelVideoResult, VideoDiscoveryResult } from './search'
export type {
  TranscriptData,
  TranscriptSegment,
  VideoInfo,
  ChannelResolution,
  CreatorTranscriptStatus,
  CreatorTranscriptResult,
  PerVideoTranscript,
} from './types'
export type { YouTubeSearchResult } from './search'
export { getYouTubeKey, hasBackupKey, isUsingBackupKey, reportQuotaExhausted, isQuotaExceeded } from './api-key'
