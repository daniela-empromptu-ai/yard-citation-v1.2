/**
 * Extract Dev.to username from URL.
 *
 * Supported patterns:
 *   dev.to/username
 *   dev.to/username/article-slug
 */

const DEVTO_USER_RE = /dev\.to\/([\w-]+)/

export function extractDevtoUsername(url: string): string | null {
  const match = url.match(DEVTO_USER_RE)
  if (!match) return null

  // Exclude known non-user paths
  const reserved = new Set(['t', 'tag', 'search', 'top', 'settings', 'api', 'admin', 'pod'])
  if (reserved.has(match[1])) return null

  return match[1]
}
