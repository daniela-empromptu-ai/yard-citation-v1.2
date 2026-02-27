/**
 * Fetch YouTube video transcripts via Supadata API.
 * Replaces the previous TimedText / youtube-caption-extractor approaches
 * which were blocked by YouTube bot detection.
 */

import { Supadata } from '@supadata/js'
import { TranscriptData, TranscriptSegment } from './types'

let client: Supadata | null = null

function getClient(): Supadata {
  if (!client) {
    const apiKey = process.env.SUPADATA_API_KEY
    if (!apiKey) {
      throw new Error('SUPADATA_API_KEY not configured in .env.local')
    }
    client = new Supadata({ apiKey })
  }
  return client
}

/**
 * Build a transcript for a YouTube video using Supadata.
 * Keeps the same export name and return type so nothing else changes.
 */
export async function buildTranscriptFromTimedText(
  videoId: string,
  lang: string = 'en'
): Promise<TranscriptData | null> {
  try {
    const supadata = getClient()
    const url = `https://www.youtube.com/watch?v=${videoId}`

    console.log(`[transcript] Fetching ${videoId} via Supadata...`)
    const result = await supadata.transcript({ url, lang, text: false })
    console.log(`[transcript] ${videoId} response keys:`, Object.keys(result), 'content type:', typeof (result as { content?: unknown }).content)

    // Handle async job (large videos)
    if ('jobId' in result && result.jobId) {
      console.log(`[transcript] ${videoId} is async job: ${result.jobId}`)
      const transcript = await pollJob(supadata, result.jobId)
      if (!transcript) { console.log(`[transcript] ${videoId} job returned no transcript`); return null }
      return toTranscriptData(videoId, lang, transcript)
    }

    // Direct response
    const parsed = toTranscriptData(videoId, lang, result as { content: unknown; lang: string })
    console.log(`[transcript] ${videoId} result: ${parsed ? parsed.segments.length + ' segments' : 'null'}`)
    return parsed
  } catch (e) {
    console.error(`[transcript] Supadata error for ${videoId}:`, (e as Error).message)
    return null
  }
}

async function pollJob(
  supadata: Supadata,
  jobId: string,
  maxAttempts = 30
): Promise<{ content: unknown; lang: string } | null> {
  for (let i = 0; i < maxAttempts; i++) {
    const job = await supadata.transcript.getJobStatus(jobId)
    if (job.status === 'completed' && job.result) return job.result
    if (job.status === 'failed') return null
    await new Promise(r => setTimeout(r, 1000))
  }
  return null
}

function toTranscriptData(
  videoId: string,
  lang: string,
  result: { content: unknown; lang: string }
): TranscriptData | null {
  const { content } = result

  if (typeof content === 'string') {
    if (!content.trim()) return null
    return {
      videoId,
      language: result.lang || lang,
      segments: [{ text: content, start: 0, duration: 0 }],
      fullText: content,
    }
  }

  if (Array.isArray(content)) {
    const segments: TranscriptSegment[] = content
      .filter((c: { text?: string }) => c.text?.trim())
      .map((c: { text: string; offset?: number; duration?: number }) => ({
        text: c.text.trim(),
        start: (c.offset ?? 0) / 1000,
        duration: (c.duration ?? 0) / 1000,
      }))

    if (segments.length === 0) return null

    return {
      videoId,
      language: result.lang || lang,
      segments,
      fullText: segments.map(s => s.text).join(' '),
    }
  }

  return null
}
