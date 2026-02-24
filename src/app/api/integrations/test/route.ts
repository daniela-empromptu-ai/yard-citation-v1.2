import { NextRequest, NextResponse } from 'next/server';
import { dbQuery, t } from '@/lib/db';
import { isAnthropicConfigured, isYouTubeConfigured, isRedditConfigured } from '@/lib/anthropic';

export async function POST(req: NextRequest) {
  const { integration_key } = await req.json();
  const now = new Date().toISOString();

  let result: 'success' | 'failure' = 'failure';
  let message = '';

  switch (integration_key) {
    case 'anthropic': {
      if (!isAnthropicConfigured()) {
        message = 'ANTHROPIC_API_KEY is not configured (placeholder value detected)';
      } else {
        try {
          const { getAnthropicClient } = await import('@/lib/anthropic');
          const client = getAnthropicClient();
          await client.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Say "ok"' }],
          });
          result = 'success';
          message = 'Connection successful. Model: claude-3-5-sonnet-20241022';
        } catch (err: unknown) {
          message = err instanceof Error ? err.message : String(err);
        }
      }
      break;
    }
    case 'youtube': {
      if (!isYouTubeConfigured()) {
        message = 'YOUTUBE_API_KEY not configured. V0: using stub responses.';
      } else {
        message = 'YouTube API key configured. V0 uses stubbed responses.';
      }
      result = 'success';
      break;
    }
    case 'reddit': {
      if (!isRedditConfigured()) {
        message = 'REDDIT credentials not configured. V0: using stub responses.';
      } else {
        message = 'Reddit credentials configured. V0 uses stubbed responses.';
      }
      result = 'success';
      break;
    }
    case 'gumshoe': {
      message = 'Gumshoe: manual CSV import available in campaign setup.';
      result = 'success';
      break;
    }
    default:
      message = `Unknown integration: ${integration_key}`;
  }

  await dbQuery(
    `UPDATE ${t('integration_status')} SET last_tested_at=$1, last_test_result=$2, last_test_message=$3, is_configured=$4, updated_at=$5 WHERE integration_key=$6`,
    [now, result, message, result === 'success', now, integration_key]
  );

  return NextResponse.json({ result, message });
}
