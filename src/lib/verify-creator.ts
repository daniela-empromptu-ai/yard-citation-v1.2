/**
 * Verify LLM-suggested creators actually exist on the claimed platform
 * and have content in the tech domain.
 *
 * Catches two classes of errors:
 * 1. Fictional handles (don't exist at all)
 * 2. Wrong-domain handles (exist but are cooking, yoga, gaming channels)
 *
 * The relevance check is a broad TECH DOMAIN gate (~80 words).
 * If ANY tech word appears in video titles → verified (let prequalify AI handle relevance).
 * If ZERO tech words in 10 titles → rejected (wrong domain).
 * Fine-grained relevance scoring happens later in the prequalify AI step.
 */

import { resolveChannelId, getChannelVideos } from '@/lib/youtube'
import { fetchDevtoArticles } from '@/lib/devto/api'
import { fetchMediumArticles } from '@/lib/medium/feed-parser'

export interface VerificationResult {
  verified: boolean
  realName?: string
  reason: string
  subscriberCount?: number
}

interface CreatorToVerify {
  name: string
  platform: string
  handle: string
  url: string
  suggested_categories: string[]
}

/**
 * Broad tech vocabulary set. If ANY of these words appear in content titles,
 * the creator is in the tech domain. This replaces narrow campaign-keyword matching
 * which false-rejected creators like Joe Karlsson.
 */
const TECH_VOCABULARY = new Set([
  // Programming & languages
  'code', 'coding', 'programming', 'developer', 'dev', 'software', 'engineer',
  'javascript', 'typescript', 'python', 'rust', 'golang', 'java', 'react', 'vue',
  'angular', 'node', 'nodejs', 'deno', 'bun', 'swift', 'kotlin', 'ruby', 'php',
  'html', 'css', 'sql', 'graphql', 'grpc',
  // DevOps & infrastructure
  'devops', 'kubernetes', 'k8s', 'docker', 'container', 'terraform', 'ansible',
  'jenkins', 'ci/cd', 'cicd', 'pipeline', 'deploy', 'deployment', 'infrastructure',
  'cloud', 'aws', 'azure', 'gcp', 'linux', 'nginx', 'helm', 'argocd', 'gitops',
  // Testing & quality
  'testing', 'test', 'qa', 'automation', 'selenium', 'cypress', 'playwright',
  'unit test', 'integration', 'e2e', 'tdd', 'bdd',
  // AI & data
  'ai', 'machine learning', 'llm', 'gpt', 'chatgpt', 'openai', 'langchain',
  'neural', 'deep learning', 'data science', 'ml', 'nlp', 'rag',
  // General tech
  'api', 'backend', 'frontend', 'fullstack', 'full-stack', 'microservice',
  'database', 'postgres', 'mongodb', 'redis', 'kafka',
  'git', 'github', 'gitlab', 'open source', 'opensource',
  'security', 'cybersecurity', 'infosec', 'vulnerability',
  'monitoring', 'observability', 'prometheus', 'grafana',
  'serverless', 'lambda', 'function', 'webhook', 'rest',
  'architecture', 'scalability', 'performance', 'debugging',
  'tutorial', 'tech', 'terminal', 'cli', 'sdk', 'framework',
  'agile', 'scrum', 'sprint', 'jira',
])

/**
 * Check if content text contains any tech domain words.
 */
function hasTechContent(contentText: string): boolean {
  const lower = contentText.toLowerCase()
  const words = Array.from(TECH_VOCABULARY)
  for (let i = 0; i < words.length; i++) {
    if (lower.includes(words[i])) return true
  }
  return false
}

/**
 * Check that a creator handle exists on the platform and has tech-domain content.
 * Returns verified=true only if the handle exists AND content is in the tech domain.
 */
export async function verifyCreator(
  creator: CreatorToVerify,
  _campaignTopics: string[] // kept for API compatibility, no longer used for matching
): Promise<VerificationResult> {
  const handle = (creator.handle || '').replace(/^@/, '')
  if (!handle) return { verified: false, reason: 'No handle provided' }

  try {
    switch (creator.platform) {
      case 'youtube':
        return await verifyYouTube(creator, handle)
      case 'devto':
        return await verifyDevto(handle)
      case 'medium':
        return await verifyMedium(handle)
      default:
        return { verified: false, reason: `Unsupported platform: ${creator.platform}` }
    }
  } catch (e) {
    console.log(`[verify] ${creator.platform}/${handle}: error — ${(e as Error).message}`)
    return { verified: false, reason: `Verification error: ${(e as Error).message}` }
  }
}

// ─── YouTube ───

async function verifyYouTube(
  creator: CreatorToVerify,
  handle: string
): Promise<VerificationResult> {
  const url = creator.url || `https://www.youtube.com/@${handle}`

  // Step 1: Does the channel exist?
  const resolution = await resolveChannelId(url)
  if (!resolution.channelId) {
    return { verified: false, reason: `YouTube channel not found for @${handle}` }
  }

  // Step 2: Does it have videos?
  const videos = await getChannelVideos(resolution.channelId, 10)
  if (videos.length === 0) {
    return { verified: false, reason: `YouTube channel @${handle} has no videos` }
  }

  // Step 3: Do any video titles contain tech-domain words?
  const videoText = videos.map(v => v.title).join(' ')
  if (!hasTechContent(videoText)) {
    const sampleTitles = videos.slice(0, 3).map(v => `"${v.title}"`).join(', ')
    return {
      verified: false,
      reason: `YouTube @${handle} exists but not tech content. Videos: ${sampleTitles}`,
    }
  }

  console.log(`[verify] youtube/@${handle}: verified (tech domain content found in ${videos.length} videos)`)
  return { verified: true, reason: 'Channel exists with tech-domain content', subscriberCount: resolution.subscriberCount }
}

// ─── Dev.to ───

async function verifyDevto(handle: string): Promise<VerificationResult> {
  const result = await fetchDevtoArticles(handle, 5)

  if (result.status === 'no_user') {
    return { verified: false, reason: `Dev.to user "${handle}" does not exist` }
  }

  if (result.status !== 'success' || result.articles.length === 0) {
    return { verified: false, reason: `Dev.to user "${handle}" has no articles` }
  }

  const allText = result.articles
    .map(a => `${a.title} ${Array.isArray(a.tags) ? a.tags.join(' ') : (a.tags || '')}`)
    .join(' ')

  if (!hasTechContent(allText)) {
    const sampleTitles = result.articles.slice(0, 3).map(a => `"${a.title}"`).join(', ')
    return {
      verified: false,
      reason: `Dev.to "${handle}" exists but not tech content. Articles: ${sampleTitles}`,
    }
  }

  console.log(`[verify] devto/${handle}: verified (tech domain content found)`)
  return { verified: true, reason: 'User exists with tech-domain content' }
}

// ─── Medium ───

async function verifyMedium(handle: string): Promise<VerificationResult> {
  const result = await fetchMediumArticles(handle, 5)

  if (result.status === 'no_feed') {
    return { verified: false, reason: `Medium user "@${handle}" not found (no RSS feed)` }
  }

  if (result.status !== 'success' || result.articles.length === 0) {
    return { verified: false, reason: `Medium user "@${handle}" has no articles` }
  }

  const allText = result.articles.map(a => a.title).join(' ')

  if (!hasTechContent(allText)) {
    const sampleTitles = result.articles.slice(0, 3).map(a => `"${a.title}"`).join(', ')
    return {
      verified: false,
      reason: `Medium "@${handle}" exists but not tech content. Articles: ${sampleTitles}`,
    }
  }

  console.log(`[verify] medium/@${handle}: verified (tech domain content found)`)
  return { verified: true, reason: 'User exists with tech-domain content' }
}
