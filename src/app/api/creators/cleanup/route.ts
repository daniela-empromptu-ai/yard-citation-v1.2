import { NextRequest, NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * DELETE /api/creators/cleanup?source=campaign_discovery
 * Removes creators by discovered_via filter with full FK cascade.
 * Also removes any extra categories added during discovery.
 */
export async function DELETE(req: NextRequest) {
  try {
    const source = new URL(req.url).searchParams.get('source') || 'campaign_discovery'

    // Find creators matching the filter
    const creatorRows = await dbQuery<{ id: string; name: string; platform: string }>(
      `SELECT id, name, platform FROM creators WHERE discovered_via = $1`,
      [source]
    )
    const ids = creatorRows.data.map(r => r.id)

    if (ids.length === 0) {
      return NextResponse.json({ message: 'No creators to clean up', deleted: 0 })
    }

    // Delete linked data in FK order (same pattern as seed-demo DELETE)
    for (const id of ids) {
      const ccRows = await dbQuery<{ id: string }>(
        'SELECT id FROM campaign_creators WHERE creator_id = $1',
        [id]
      )
      for (const cc of ccRows.data) {
        await dbQuery(
          'DELETE FROM evidence_snippets WHERE evaluation_id IN (SELECT id FROM creator_evaluations WHERE campaign_creator_id = $1)',
          [cc.id]
        )
        await dbQuery(
          'DELETE FROM content_angles WHERE evaluation_id IN (SELECT id FROM creator_evaluations WHERE campaign_creator_id = $1)',
          [cc.id]
        )
        await dbQuery('DELETE FROM creator_evaluations WHERE campaign_creator_id = $1', [cc.id])
      }
      await dbQuery('DELETE FROM campaign_creators WHERE creator_id = $1', [id])
      await dbQuery('DELETE FROM content_items WHERE creator_id = $1', [id])
      await dbQuery('DELETE FROM creator_categories WHERE creator_id = $1', [id])
      await dbQuery('DELETE FROM activity_log WHERE creator_id = $1', [id])
      await dbQuery('DELETE FROM creators WHERE id = $1', [id])
    }

    const deleted = creatorRows.data.map(r => `${r.name} (${r.platform})`)
    return NextResponse.json({ deleted: ids.length, creators: deleted })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
