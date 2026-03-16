/**
 * Creator exclusion guardrails: brand blocklist, dormancy check, autodub detection.
 *
 * Hard server-side filters that complement the LLM prompt instructions
 * (soft exclusion rules in ai-actions.ts discovery/prequalify prompts).
 */

// ─── Brand Blocklist ───

interface BrandEntry {
  name: string
  patterns: string[]
}

const BRAND_BLOCKLIST: BrandEntry[] = [
  { name: 'AWS', patterns: ['amazon web services', 'aws official', 'aws online tech talks', 'aws events', 'aws developers'] },
  { name: 'HashiCorp', patterns: ['hashicorp'] },
  { name: 'Microsoft', patterns: ['microsoft azure', 'microsoft developer', 'microsoft ignite', 'azure devops', 'microsoft mechanics'] },
  { name: 'Google Cloud', patterns: ['google cloud', 'google cloud tech', 'google developers', 'google open source', 'gcp'] },
  { name: 'IBM', patterns: ['ibm technology', 'ibm cloud', 'ibm developer'] },
  { name: 'Red Hat', patterns: ['red hat', 'redhat'] },
  { name: 'VMware', patterns: ['vmware', 'broadcom'] },
  { name: 'Oracle', patterns: ['oracle', 'oracle developers'] },
  { name: 'Datadog', patterns: ['datadog'] },
  { name: 'New Relic', patterns: ['new relic'] },
  { name: 'Splunk', patterns: ['splunk'] },
  { name: 'Confluent', patterns: ['confluent'] },
  { name: 'Elastic', patterns: ['elastic official', 'elasticsearch'] },
  { name: 'Cisco', patterns: ['cisco', 'cisco devnet'] },
  { name: 'Docker Inc', patterns: ['docker inc', 'docker official'] },
  { name: 'CNCF', patterns: ['cncf', 'cloud native computing'] },
  { name: 'Linux Foundation', patterns: ['linux foundation', 'linuxfoundation'] },
  { name: 'GitLab', patterns: ['gitlab'] },
  { name: 'GitHub', patterns: ['github official', 'github corp'] },
  { name: 'Snyk', patterns: ['snyk'] },
  { name: 'Wiz', patterns: ['wiz io', 'wiz security'] },
  { name: 'Grafana Labs', patterns: ['grafana labs', 'grafana official'] },
  { name: 'MongoDB', patterns: ['mongodb'] },
  { name: 'Cloudflare', patterns: ['cloudflare tv', 'cloudflare official'] },
  { name: 'DigitalOcean', patterns: ['digitalocean'] },
  { name: 'Vercel', patterns: ['vercel official'] },
  { name: 'Supabase', patterns: ['supabase official'] },
]

/**
 * Check if a creator appears to be a brand/vendor-owned channel.
 * Matches against name, handle, and URL (case-insensitive substring match).
 */
export function isBrandOwned(name: string, handle?: string | null, url?: string | null): boolean {
  const haystack = [name, handle || '', url || ''].join(' ').toLowerCase()

  for (const brand of BRAND_BLOCKLIST) {
    for (const pattern of brand.patterns) {
      if (haystack.includes(pattern.toLowerCase())) {
        return true
      }
    }
  }

  return false
}

// ─── Dormancy Check ───

const TWO_YEARS_MS = 2 * 365.25 * 24 * 60 * 60 * 1000

/**
 * Returns true if the creator hasn't published in 2+ years (or has no content date).
 */
export function isDormant(lastPublishedAt: string | null): boolean {
  if (!lastPublishedAt) return true
  const lastDate = new Date(lastPublishedAt)
  if (isNaN(lastDate.getTime())) return true
  return Date.now() - lastDate.getTime() > TWO_YEARS_MS
}

// ─── Autodub Detection ───

/**
 * Check YouTube video/channel metadata for signs of auto-dubbing.
 * Looks for language mismatches and auto-translation markers.
 */
export function isAutodubbed(metadata: Record<string, unknown>): boolean {
  const title = String(metadata.title || '').toLowerCase()
  if (title.includes('[auto-translated]') || title.includes('[auto-dubbed]')) {
    return true
  }

  // defaultAudioLanguage differing from channel language suggests auto-dubbing
  const audioLang = metadata.defaultAudioLanguage as string | undefined
  const channelLang = metadata.defaultLanguage as string | undefined
  if (audioLang && channelLang && audioLang.slice(0, 2) !== channelLang.slice(0, 2)) {
    return true
  }

  return false
}

// ─── LLM Exclusion Rules (for prompt injection) ───

export const EXCLUSION_RULES_PROMPT = `
EXCLUSION RULES — do NOT suggest any of these:
- Company/vendor-owned channels (e.g. AWS, HashiCorp, Microsoft, Google Cloud, IBM, Red Hat, Docker Inc, CNCF, GitLab, Datadog, New Relic, Splunk)
- Creators who haven't published in 2+ years
- Channels with primarily AI-generated or synthetic content
- Auto-dubbed/auto-translated content
- Lifestyle, vlog, or non-technical content creators
Only suggest independent technical content creators.`
