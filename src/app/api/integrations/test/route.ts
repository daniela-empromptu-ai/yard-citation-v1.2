import { NextRequest, NextResponse } from 'next/server';
import { dbQuery, t } from '@/lib/db';
import { isYouTubeConfigured, isGumshoeConfigured } from '@/lib/anthropic';

export async function POST(req: NextRequest) {
  const { integration_key } = await req.json();
  const now = new Date().toISOString();

  let result: 'success' | 'failure' = 'failure';
  let message = '';

  switch (integration_key) {
    case 'youtube': {
      if (!isYouTubeConfigured()) {
        message = 'YOUTUBE_API_KEY not configured.';
      } else {
        result = 'success';
        message = 'YouTube API key configured.';
      }
      break;
    }
    case 'gumshoe': {
      if (!isGumshoeConfigured()) {
        message = 'GUMSHOE_API_KEY not configured. Gumshoe citation extraction disabled.';
      } else {
        result = 'success';
        message = 'Gumshoe API key configured. Citation extraction enabled.';
      }
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
