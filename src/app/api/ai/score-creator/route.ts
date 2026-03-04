import { NextRequest, NextResponse } from 'next/server';
import { scoreCreator } from '@/lib/score-creator';

export async function POST(req: NextRequest) {
  const { campaign_creator_id } = await req.json();

  if (!campaign_creator_id) {
    return NextResponse.json({ error: 'campaign_creator_id required' }, { status: 400 });
  }

  try {
    const result = await scoreCreator(campaign_creator_id);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.error?.includes('not found') ? 404 : 400 });
    }
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
