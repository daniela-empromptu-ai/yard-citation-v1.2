/**
 * Google Sheets fetching + parsing for creator discovery.
 * Uses raw HTTP to Sheets API v4 (no googleapis SDK).
 * Expects a frozen header row as row 1.
 *
 * New sheet format: one row per creator, 28 columns,
 * platform-specific handle/subscriber columns.
 */

import { v5 as uuidv5 } from 'uuid';

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

// Deterministic UUID namespace for creator IDs derived from name slugs.
// Previously duplicated in pipeline.ts and discover/route.ts.
export const CREATOR_UUID_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

// ─── Column Mapping ───

// Fuzzy column aliases: canonical key -> possible header strings (lowercase)
const COLUMN_ALIASES: Record<string, string[]> = {
  creator_name:             ['creator name', 'creator_name', 'name'],
  primary_platform:         ['primary platform', 'primary_platform', 'platform'],
  niche_batch:              ['niche batch', 'niche_batch', 'niche', 'batch'],
  youtube_handle:           ['youtube handle', 'youtube_handle', 'yt handle', 'yt_handle'],
  youtube_subscribers:      ['youtube subscribers', 'youtube_subscribers', 'yt subscribers', 'yt_subscribers'],
  medium_handle:            ['medium handle', 'medium_handle'],
  devto_handle:             ['dev.to handle', 'devto handle', 'devto_handle', 'dev.to_handle'],
  linkedin_url:             ['linkedin url', 'linkedin_url', 'linkedin'],
  github_url:               ['github url', 'github_url', 'github'],
  newsletter_url:           ['newsletter url', 'newsletter_url', 'newsletter'],
  podcast_name:             ['podcast name', 'podcast_name', 'podcast'],
  blog_website_url:         ['blog/website url', 'blog/website_url', 'blog url', 'blog_url', 'website url', 'website_url', 'blog', 'website'],
  email:                    ['email', 'email address', 'contact email'],
  contact_method:           ['contact method', 'contact_method', 'preferred contact'],
  primary_categories:       ['primary categories (controlled)', 'primary categories', 'primary_categories', 'categories'],
  content_depth:            ['content depth', 'content_depth', 'depth'],
  secondary_tags:           ['secondary tags (free-text)', 'secondary tags', 'secondary_tags', 'tags'],
  content_types:            ['content types', 'content_types', 'content type'],
  posting_frequency:        ['posting frequency', 'posting_frequency', 'frequency'],
  last_published:           ['last published (approx)', 'last published', 'last_published', 'last published date'],
  content_language:         ['content language', 'content_language', 'language', 'lang'],
  follower_subscriber_metric: ['follower/subscriber metric', 'follower_subscriber_metric', 'followers', 'subscriber metric'],
  engagement_notes:         ['engagement notes', 'engagement_notes'],
  verification_status:      ['verification status', 'verification_status', 'verified'],
  source:                   ['source', 'data source'],
  notes:                    ['notes', 'note', 'comments'],
  date_added:               ['date added', 'date_added', 'added date'],
  added_by:                 ['added by', 'added_by'],
};

const REQUIRED_COLUMNS = ['creator_name', 'primary_platform'];

// Platform column config: maps platform name to its handle/subscriber columns
const PLATFORM_COLUMNS: {
  platform: string;
  handleCol?: string;
  urlCol?: string;
  subscriberCol?: string;
}[] = [
  { platform: 'youtube',    handleCol: 'youtube_handle',   subscriberCol: 'youtube_subscribers' },
  { platform: 'medium',     handleCol: 'medium_handle' },
  { platform: 'devto',      handleCol: 'devto_handle' },
  { platform: 'linkedin',   urlCol: 'linkedin_url' },
  { platform: 'github',     urlCol: 'github_url' },
  { platform: 'newsletter', urlCol: 'newsletter_url' },
  { platform: 'podcast',    handleCol: 'podcast_name' },
  { platform: 'blog',       urlCol: 'blog_website_url' },
];

// ─── Types ───

export interface SheetRow {
  [key: string]: string;
}

export interface ParsedCreatorPlatform {
  platform: string;
  handle: string | null;
  url: string | null;
  follower_count: number | null;
  metrics: Record<string, string>;
}

export interface ParsedCreator {
  creator_id: string;
  creator_name: string;
  primary_platform: string;
  primary_categories: string[];
  secondary_tags: string[];
  content_language: string | null;
  posting_frequency: string | null;
  last_published: string | null;
  email: string | null;
  contact_method: string | null;
  linkedin_url: string | null;
  platforms: ParsedCreatorPlatform[];
  total_followers: number;
  metadata: Record<string, string>;
}

// Backward compatibility alias
export type GroupedCreator = ParsedCreator;

// ─── Helpers ───

/**
 * Slugify a creator name for deterministic UUID generation.
 * Lowercases, replaces non-alphanumeric with hyphens, trims hyphens.
 */
export function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Generate a deterministic UUID v5 from a creator name.
 */
export function generateCreatorId(name: string): string {
  return uuidv5(slugifyName(name), CREATOR_UUID_NAMESPACE);
}

/**
 * Build a platform URL from a handle.
 * Returns null if no URL pattern is known for the platform.
 */
export function buildPlatformUrl(platform: string, handle: string): string | null {
  const clean = handle.replace(/^@/, '').trim();
  if (!clean) return null;

  switch (platform) {
    case 'youtube':    return `https://youtube.com/@${clean}`;
    case 'medium':     return `https://medium.com/@${clean}`;
    case 'devto':      return `https://dev.to/${clean}`;
    case 'github':     return `https://github.com/${clean}`;
    case 'linkedin':   return `https://linkedin.com/in/${clean}`;
    case 'newsletter': return `https://${clean}`;
    default:           return null;
  }
}

/**
 * Parse a fuzzy date string like "Feb 2026", "March 2025", "2024-01-15", "Q1 2025"
 * into an ISO date string (YYYY-MM-DD). Returns null if unparseable.
 */
export function parseFuzzyDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Already ISO-ish: "2024-01-15" or "2024-01-15T..."
  const isoMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];

  // "Feb 2026", "March 2025", "January 2024"
  const monthYear = trimmed.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (monthYear) {
    const d = new Date(`${monthYear[1]} 1, ${monthYear[2]}`);
    if (!isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
  }

  // "Q1 2025" → Jan, "Q2 2025" → Apr, etc.
  const quarterMatch = trimmed.match(/^Q([1-4])\s+(\d{4})$/i);
  if (quarterMatch) {
    const month = (parseInt(quarterMatch[1]) - 1) * 3 + 1;
    return `${quarterMatch[2]}-${String(month).padStart(2, '0')}-01`;
  }

  // Last resort: try native Date parse
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }

  return null;
}

/**
 * Infer dormancy from posting frequency and last published date.
 */
export function inferDormancy(postingFrequency: string | null, lastPublished: string | null): boolean {
  const freq = (postingFrequency || '').toLowerCase();
  if (freq.includes('inactive') || freq.includes('dormant') || freq.includes('stopped')) {
    return true;
  }

  const isoDate = parseFuzzyDate(lastPublished);
  if (isoDate) {
    const parsed = new Date(isoDate);
    const monthsAgo = (Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24 * 30);
    if (monthsAgo > 12) return true;
  }

  return false;
}

/**
 * Parse a follower/subscriber count string.
 * Handles formats: "150K", "1.2M", "10,000", "5000".
 */
export function parseFollowerCount(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/[,\s]/g, '');
  if (!cleaned) return null;

  const multiplierMatch = cleaned.match(/^([\d.]+)\s*([KkMm]?)$/);
  if (!multiplierMatch) {
    const n = parseInt(cleaned, 10);
    return isNaN(n) ? null : n;
  }

  const num = parseFloat(multiplierMatch[1]);
  if (isNaN(num)) return null;

  const suffix = multiplierMatch[2].toUpperCase();
  if (suffix === 'K') return Math.round(num * 1_000);
  if (suffix === 'M') return Math.round(num * 1_000_000);
  return Math.round(num);
}

// Metadata keys to collect into metrics_json (enrichment fields)
const METADATA_KEYS = [
  'niche_batch', 'content_depth', 'content_types', 'posting_frequency',
  'engagement_notes', 'verification_status', 'source', 'notes',
  'date_added', 'added_by',
];

function collectMetadata(row: SheetRow): Record<string, string> {
  const meta: Record<string, string> = {};
  for (const key of METADATA_KEYS) {
    if (row[key]) meta[key] = row[key];
  }
  return meta;
}

// ─── Sheet Fetching & Parsing ───

/**
 * Fetch all rows from a Google Sheets spreadsheet.
 */
export async function fetchSheetRows(
  spreadsheetId: string,
  range: string = 'Creator Database',
  apiKey?: string
): Promise<string[][]> {
  const key = apiKey || process.env.GOOGLE_SHEETS_API_KEY;
  if (!key) throw new Error('GOOGLE_SHEETS_API_KEY not configured');

  const url = `${SHEETS_API_BASE}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?key=${key}`;
  const res = await fetch(url);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Sheets API error (${res.status}): ${text}`);
  }

  const data = await res.json();
  return (data.values as string[][]) || [];
}

/**
 * Parse header row using fuzzy matching against COLUMN_ALIASES.
 */
export function parseHeaders(headerRow: string[]): { headers: Record<string, number>; warnings: string[] } {
  const warnings: string[] = [];
  const headers: Record<string, number> = {};
  const normalized = headerRow.map(h => (h || '').toLowerCase().trim());

  for (const [canonical, aliases] of Object.entries(COLUMN_ALIASES)) {
    const idx = normalized.findIndex(h => aliases.includes(h));
    if (idx !== -1) {
      headers[canonical] = idx;
    } else if (!REQUIRED_COLUMNS.includes(canonical)) {
      // Only warn for useful optional columns
      if (!['notes', 'added_by', 'date_added'].includes(canonical)) {
        warnings.push(`Optional column "${canonical}" not found`);
      }
    }
  }

  // Also map any unmapped columns by their raw header name
  for (let i = 0; i < normalized.length; i++) {
    const alreadyMapped = Object.values(headers).includes(i);
    if (!alreadyMapped && normalized[i]) {
      headers[normalized[i]] = i;
    }
  }

  const missing = REQUIRED_COLUMNS.filter(c => headers[c] === undefined);
  if (missing.length > 0) {
    throw new Error(`Required columns missing: ${missing.join(', ')}. Found headers: ${headerRow.join(', ')}`);
  }

  return { headers, warnings };
}

/**
 * Parse the full sheet: row 1 = headers, rest = data.
 */
export function parseSheet(rawRows: string[][]): {
  headers: Record<string, number>;
  rows: SheetRow[];
  warnings: string[];
} {
  if (rawRows.length < 2) {
    return { headers: {}, rows: [], warnings: ['Sheet is empty or has no data rows'] };
  }

  const { headers, warnings } = parseHeaders(rawRows[0]);

  const rows = rawRows.slice(1).map(row => {
    const obj: SheetRow = {};
    for (const [canonical, idx] of Object.entries(headers)) {
      obj[canonical] = (row[idx] || '').trim();
    }
    return obj;
  });

  return { headers, rows, warnings };
}

// ─── Creator Parsing ───

/**
 * Parse sheet rows into ParsedCreator objects.
 * New sheet format: one row per creator, platform info in separate columns.
 * Generates deterministic UUID v5 from slugified Creator Name.
 */
export function parseCreators(rows: SheetRow[]): ParsedCreator[] {
  const creators: ParsedCreator[] = [];

  for (const row of rows) {
    const name = row.creator_name;
    if (!name) continue;

    const primaryPlatform = (row.primary_platform || '').toLowerCase().trim();
    const creatorId = generateCreatorId(name);

    // Parse topics: comma-separated
    const primaryCategories = (row.primary_categories || '')
      .split(',').map(s => s.trim()).filter(Boolean);
    const secondaryTags = (row.secondary_tags || '')
      .split(',').map(s => s.trim()).filter(Boolean);

    // Extract platforms from column pairs
    const platforms: ParsedCreatorPlatform[] = [];
    let totalFollowers = 0;

    for (const pc of PLATFORM_COLUMNS) {
      let handle: string | null = null;
      let url: string | null = null;
      let followerCount: number | null = null;

      if (pc.handleCol && row[pc.handleCol]) {
        handle = row[pc.handleCol];
      }
      if (pc.urlCol && row[pc.urlCol]) {
        // URL columns contain full URLs already
        url = row[pc.urlCol];
        // For LinkedIn, the URL column doubles as handle
        if (pc.platform === 'linkedin' && !handle) {
          handle = url;
        }
      }

      // Skip if no handle and no URL
      if (!handle && !url) continue;

      // Build URL from handle if we don't have one
      if (!url && handle) {
        url = buildPlatformUrl(pc.platform, handle);
      }

      // Skip entries where we can't construct a URL (e.g., podcast name only)
      if (!url) continue;

      // Subscriber count from platform-specific column
      if (pc.subscriberCol && row[pc.subscriberCol]) {
        followerCount = parseFollowerCount(row[pc.subscriberCol]);
      }

      // For primary platform, also check the generic follower column as fallback
      if (followerCount === null && pc.platform === primaryPlatform) {
        followerCount = parseFollowerCount(row.follower_subscriber_metric);
      }

      if (followerCount) totalFollowers += followerCount;

      platforms.push({
        platform: pc.platform,
        handle: handle ? handle.replace(/^@/, '').trim() : null,
        url,
        follower_count: followerCount,
        metrics: collectMetadata(row),
      });
    }

    creators.push({
      creator_id: creatorId,
      creator_name: name,
      primary_platform: primaryPlatform || 'unknown',
      primary_categories: primaryCategories,
      secondary_tags: secondaryTags,
      content_language: row.content_language || null,
      posting_frequency: row.posting_frequency || null,
      last_published: row.last_published || null,
      email: row.email || null,
      contact_method: row.contact_method || null,
      linkedin_url: row.linkedin_url || null,
      platforms,
      total_followers: totalFollowers,
      metadata: collectMetadata(row),
    });
  }

  return creators;
}

/**
 * Backward compatibility alias for groupByCreator.
 * New code should use parseCreators() directly.
 */
export function groupByCreator(rows: SheetRow[]): ParsedCreator[] {
  return parseCreators(rows);
}
