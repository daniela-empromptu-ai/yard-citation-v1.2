/**
 * Environment configuration checks.
 * All LLM calls go through the Empromptu builder API (callAIApi in db.ts).
 */

function isPlaceholder(val: string | undefined): boolean {
  return !val || val === 'placeholder' || val.startsWith('your-') || val.startsWith('placeholder_')
}

export function isYouTubeConfigured(): boolean {
  return !isPlaceholder(process.env.YOUTUBE_API_KEY)
}

export function isGumshoeConfigured(): boolean {
  return !isPlaceholder(process.env.GUMSHOE_API_KEY)
}
