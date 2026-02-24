import { NextRequest, NextResponse } from 'next/server';
import { dbQuery, t } from '@/lib/db';
import { isRedditConfigured } from '@/lib/anthropic';

interface RedditPost {
  title: string;
  url: string;
  subreddit: string;
  karma: number;
  comment_count: number;
  reddit_post_id: string;
  created_utc: number;
  selftext?: string;
}

async function fetchRedditStub(subreddits: string[], keywords: string[]): Promise<RedditPost[]> {
  // Stub response for V0
  const subs = subreddits.length > 0 ? subreddits : ['kubernetes', 'devops', 'sre'];
  const kws = keywords.length > 0 ? keywords : ['kubernetes cost', 'finops', 'kubecost'];

  return subs.slice(0, 3).map((sub, i) => ({
    title: `[Stub] ${kws[i % kws.length]} discussion in r/${sub}`,
    url: `https://reddit.com/r/${sub}/comments/stub${i + 1}`,
    subreddit: sub,
    karma: Math.floor(Math.random() * 500) + 50,
    comment_count: Math.floor(Math.random() * 100) + 10,
    reddit_post_id: `stub${i + 1}`,
    created_utc: Date.now() / 1000 - i * 86400,
    selftext: `This is a stub Reddit thread about ${kws[i % kws.length]}. Configure REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET to fetch real threads.`,
  }));
}

async function fetchRedditReal(subreddits: string[], keywords: string[]): Promise<RedditPost[]> {
  // Get access token
  const tokenRes = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!tokenRes.ok) throw new Error('Failed to get Reddit access token');
  const { access_token } = await tokenRes.json();

  const posts: RedditPost[] = [];

  for (const subreddit of subreddits.slice(0, 5)) {
    for (const keyword of keywords.slice(0, 3)) {
      const searchRes = await fetch(
        `https://oauth.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(keyword)}&restrict_sr=1&sort=new&limit=5`,
        { headers: { Authorization: `Bearer ${access_token}`, 'User-Agent': 'YardCreatorOps/1.0' } }
      );

      if (!searchRes.ok) continue;
      const data = await searchRes.json();

      for (const child of data.data?.children || []) {
        const post = child.data;
        posts.push({
          title: post.title,
          url: `https://reddit.com${post.permalink}`,
          subreddit: post.subreddit,
          karma: post.score,
          comment_count: post.num_comments,
          reddit_post_id: post.id,
          created_utc: post.created_utc,
          selftext: post.selftext?.slice(0, 1000) || '',
        });
      }
    }
  }

  return posts;
}

export async function POST(req: NextRequest) {
  const { campaign_id, creator_id, subreddits = [], keywords = [] } = await req.json();

  try {
    const posts = isRedditConfigured()
      ? await fetchRedditReal(subreddits, keywords)
      : await fetchRedditStub(subreddits, keywords);

    const now = new Date().toISOString();
    let inserted = 0;
    let skipped = 0;

    // Find a creator_id to associate with if not provided
    let crId = creator_id;
    if (!crId && campaign_id) {
      const ccRes = await dbQuery<{ creator_id: string }>(
        `SELECT creator_id FROM ${t('campaign_creators')} WHERE campaign_id = $1 LIMIT 1`,
        [campaign_id]
      );
      crId = ccRes.data[0]?.creator_id;
    }
    if (!crId) crId = 'd0000001-0000-0000-0000-000000000001'; // fallback to Nina

    for (const post of posts) {
      const pubDate = new Date(post.created_utc * 1000).toISOString();
      const rawText = `[Reddit Thread: r/${post.subreddit}]\n\nTitle: ${post.title}\n\n${post.selftext || ''}`;
      const meta = JSON.stringify({
        subreddit: post.subreddit,
        karma: post.karma,
        comment_count: post.comment_count,
        reddit_post_id: post.reddit_post_id,
      });

      const r = await dbQuery(
        `INSERT INTO ${t('content_items')} (creator_id, campaign_id, platform, content_type, title, url, published_at, fetched_at, language, raw_text, word_count, metadata_json, ingestion_method, ingestion_status, created_at, updated_at)
         VALUES ($1,$2,'reddit','reddit_thread',$3,$4,$5,$6,'English',$7,$8,$9::jsonb,'fetched','complete',$10,$11) ON CONFLICT DO NOTHING`,
        [crId, campaign_id || null, post.title, post.url, pubDate, now, rawText,
         rawText.split(/\s+/).length, meta, now, now]
      );

      if (r.affected_rows > 0) inserted++;
      else skipped++;
    }

    return NextResponse.json({ ok: true, inserted, skipped, total: posts.length });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
