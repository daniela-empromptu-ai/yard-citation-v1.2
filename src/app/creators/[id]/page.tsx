import { dbQuery } from '@/lib/db';
import { notFound } from 'next/navigation';
import CreatorProfileClient from '@/components/creators/CreatorProfile';

export const dynamic = 'force-dynamic';

export default async function CreatorProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [creatorRes, categoriesRes, contentRes, evaluationsRes, campaignsRes] = await Promise.all([
    dbQuery(`SELECT * FROM creators WHERE id = $1`, [id]),
    dbQuery(
      `SELECT cat.* FROM categories cat JOIN creator_categories cc ON cc.category_id = cat.id WHERE cc.creator_id = $1 ORDER BY cat.name`,
      [id]
    ),
    dbQuery(`SELECT id, title, url, platform, content_type, word_count, published_at, metadata_json FROM content_items WHERE creator_id = $1 ORDER BY published_at DESC NULLS LAST LIMIT 20`, [id]),
    dbQuery(`
      SELECT e.*, cc.pipeline_stage, camp.name as campaign_name, camp.id as campaign_id
      FROM creator_evaluations e
      JOIN campaign_creators cc ON cc.id = e.campaign_creator_id
      JOIN campaigns camp ON camp.id = cc.campaign_id
      WHERE cc.creator_id = $1
      ORDER BY e.evaluated_at DESC
    `, [id]),
    dbQuery(`
      SELECT ccr.*, camp.name as campaign_name, cl.name as client_name
      FROM campaign_creators ccr
      JOIN campaigns camp ON camp.id = ccr.campaign_id
      JOIN clients cl ON cl.id = camp.client_id
      WHERE ccr.creator_id = $1
      ORDER BY ccr.created_at DESC
    `, [id]),
  ]);

  if (!creatorRes.data.length) notFound();

  return (
    <CreatorProfileClient
      creator={creatorRes.data[0] as any}
      categories={categoriesRes.data as any[]}
      content={contentRes.data as any[]}
      evaluations={evaluationsRes.data as any[]}
      campaigns={campaignsRes.data as any[]}
    />
  );
}
