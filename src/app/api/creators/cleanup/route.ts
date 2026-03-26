import { NextRequest, NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * DELETE /api/creators/cleanup?source=campaign_discovery
 * DELETE /api/creators/cleanup?filter=no_categories
 * Removes creators by discovered_via filter or by missing categories, with full FK cascade.
 */
export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const source = url.searchParams.get('source')
    const filter = url.searchParams.get('filter')

    let creatorRows: { data: { id: string; name: string; platform: string }[] }

    if (filter === 'all') {
      creatorRows = await dbQuery<{ id: string; name: string; platform: string }>(
        `SELECT id, name, platform FROM creators`,
        []
      )
    } else if (filter === 'no_categories') {
      creatorRows = await dbQuery<{ id: string; name: string; platform: string }>(
        `SELECT c.id, c.name, c.platform FROM creators c
         LEFT JOIN creator_categories cc ON cc.creator_id = c.id
         WHERE cc.creator_id IS NULL`,
        []
      )
    } else {
      const src = source || 'campaign_discovery'
      creatorRows = await dbQuery<{ id: string; name: string; platform: string }>(
        `SELECT id, name, platform FROM creators WHERE discovered_via = $1`,
        [src]
      )
    }

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
