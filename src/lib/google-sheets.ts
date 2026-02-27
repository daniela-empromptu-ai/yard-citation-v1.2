/**
 * Google Sheets fetching + parsing for creator discovery.
 * Uses raw HTTP to Sheets API v4 (no googleapis SDK).
 * Expects a frozen header row as row 1.
 */

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

// Fuzzy column aliases: canonical name -> possible header strings
const COLUMN_ALIASES: Record<string, string[]> = {
  creator_id: ['creator_id', 'creatorid', 'creator id', 'id'],
  type: ['type', 'creator_type', 'account_type'],
  creator_name: ['creator_name', 'name', 'creator name'],
  creator_channel: ['creator_channel', 'channel', 'channel_name'],
  platform: ['platform', 'platform_name'],
  platform_username: ['platform_username', 'username', 'handle', 'platform_handle'],
  platform_url: ['platform_url', 'url', 'channel_url', 'profile_url'],
  country: ['country', 'geo', 'location', 'region'],
  primary_language: ['primary_language', 'language', 'lang'],
  yt_subscribers: ['yt_subscribers', 'youtube_subscribers'],
  medium_followers: ['medium_followers', 'medium_follower_count'],
  newsletter_subscribers: ['newsletter_subscribers', 'newsletter_subs'],
  primary_topics: ['primary_topics', 'topics', 'primary_topic', 'topic_tags', 'topic'],
  active_status: ['active_status', 'status', 'activity_status'],
  last_active_at: ['last_active_at', 'last_active', 'last_activity', 'last_content_date'],
  bio: ['bio', 'description', 'about'],
};

const REQUIRED_COLUMNS = ['creator_id', 'creator_name', 'platform', 'primary_topics'];

export interface SheetRow {
  [key: string]: string;
}

export interface GroupedCreator {
  creator_id: string;
  creator_name: string;
  creator_channel: string | null;
  country: string | null;
  primary_language: string | null;
  primary_topics: string[];
  active_status: string | null;
  last_active_at: string | null;
  bio: string | null;
  platforms: {
    platform: string;
    platform_username: string | null;
    platform_url: string | null;
    follower_count: number | null;
    metrics: Record<string, string>;
  }[];
  total_followers: number;
}

/**
 * Fetch all rows from a Google Sheets spreadsheet.
 */
export async function fetchSheetRows(
  spreadsheetId: string,
  range: string = 'Sheet1',
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
      // Only warn for useful optional columns, not trivial ones
      if (!['type', 'bio'].includes(canonical)) {
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

const PLATFORM_NORMALIZE: Record<string, string> = {
  'dev.to': 'devto',
  'dev': 'devto',
  'devto': 'devto',
  'youtube': 'youtube',
  'yt': 'youtube',
  'medium': 'medium',
  'newsletter': 'newsletter',
  'substack': 'newsletter',
  'twitter': 'twitter',
  'x': 'twitter',
  'linkedin': 'linkedin',
  'github': 'github',
  'tiktok': 'tiktok',
  'instagram': 'instagram',
  'podcast': 'podcast',
  'blog': 'blog',
  'website': 'blog',
};

function normalizePlatform(raw: string): string {
  const lower = raw.toLowerCase().trim();
  return PLATFORM_NORMALIZE[lower] || lower;
}

function parseFollowerCount(row: SheetRow, platform: string): number | null {
  const platformFollowerMap: Record<string, string> = {
    youtube: 'yt_subscribers',
    medium: 'medium_followers',
    newsletter: 'newsletter_subscribers',
  };
  const col = platformFollowerMap[platform];
  if (col && row[col]) {
    const n = parseInt(row[col].replace(/[,\s]/g, ''), 10);
    if (!isNaN(n)) return n;
  }
  return null;
}

const SKIP_METRIC_KEYS = new Set([
  'creator_id', 'type', 'creator_name', 'creator_channel', 'country', 'primary_language',
  'primary_topics', 'active_status', 'last_active_at', 'platform', 'platform_username',
  'platform_url', 'bio', 'yt_subscribers', 'medium_followers', 'newsletter_subscribers',
]);

function collectMetrics(row: SheetRow): Record<string, string> {
  const metrics: Record<string, string> = {};
  for (const [key, val] of Object.entries(row)) {
    if (!SKIP_METRIC_KEYS.has(key) && val) {
      metrics[key] = val;
    }
  }
  return metrics;
}

/**
 * Group parsed rows by creator_id, merging topics and collecting platforms.
 */
export function groupByCreator(rows: SheetRow[]): GroupedCreator[] {
  const map = new Map<string, GroupedCreator>();

  for (const row of rows) {
    const cid = row.creator_id;
    if (!cid) continue;

    const platform = normalizePlatform(row.platform || 'unknown');
    const followerCount = parseFollowerCount(row, platform);

    // Topics: comma-separated or space-separated
    const rawTopics = row.primary_topics || '';
    const rowTopics = rawTopics.includes(',')
      ? rawTopics.split(',').map(t => t.trim()).filter(Boolean)
      : rawTopics.split(/\s+/).map(t => t.trim()).filter(Boolean);

    if (!map.has(cid)) {
      map.set(cid, {
        creator_id: cid,
        creator_name: row.creator_name || 'Unknown',
        creator_channel: row.creator_channel || null,
        country: row.country || null,
        primary_language: row.primary_language || null,
        primary_topics: [],
        active_status: row.active_status || null,
        last_active_at: row.last_active_at || null,
        bio: row.bio || null,
        platforms: [],
        total_followers: 0,
      });
    }

    const creator = map.get(cid)!;

    // Merge topics (deduped, case-insensitive)
    const existingLower = new Set(creator.primary_topics.map(t => t.toLowerCase()));
    for (const topic of rowTopics) {
      if (!existingLower.has(topic.toLowerCase())) {
        creator.primary_topics.push(topic);
        existingLower.add(topic.toLowerCase());
      }
    }

    // Add platform
    creator.platforms.push({
      platform,
      platform_username: row.platform_username || null,
      platform_url: row.platform_url || null,
      follower_count: followerCount,
      metrics: collectMetrics(row),
    });

    if (followerCount) {
      creator.total_followers += followerCount;
    }
  }

  return Array.from(map.values());
}
