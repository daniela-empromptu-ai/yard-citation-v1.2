import Anthropic from '@anthropic-ai/sdk'

function isPlaceholder(val: string | undefined): boolean {
  return !val || val === 'placeholder' || val.startsWith('your-')
}

export function isAnthropicConfigured(): boolean {
  return !isPlaceholder(process.env.ANTHROPIC_API_KEY)
}

export function isRedditConfigured(): boolean {
  return (
    !isPlaceholder(process.env.REDDIT_CLIENT_ID) &&
    !isPlaceholder(process.env.REDDIT_CLIENT_SECRET)
  )
}

export function isYouTubeConfigured(): boolean {
  return !isPlaceholder(process.env.YOUTUBE_API_KEY)
}

export function getAnthropicClient(): Anthropic {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}
