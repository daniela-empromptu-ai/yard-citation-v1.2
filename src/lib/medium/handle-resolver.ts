/**
 * Extract Medium handle from various URL formats.
 *
 * Supported patterns:
 *   medium.com/@handle
 *   medium.com/@handle/article-slug
 *   handle.medium.com
 */

const AT_HANDLE_RE = /medium\.com\/@([\w.-]+)/
const SUBDOMAIN_RE = /^https?:\/\/([\w.-]+)\.medium\.com/

export function extractMediumHandle(url: string): string | null {
  const atMatch = url.match(AT_HANDLE_RE)
  if (atMatch) return atMatch[1]

  const subMatch = url.match(SUBDOMAIN_RE)
  if (subMatch && subMatch[1] !== 'www' && subMatch[1] !== 'cdn') {
    return subMatch[1]
  }

  return null
}
