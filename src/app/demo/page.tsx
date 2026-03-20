import { redirect } from 'next/navigation'
import { dbQuery, t } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function DemoPage() {
  const result = await dbQuery<{ id: string }>(
    `SELECT id FROM ${t('campaigns')} WHERE name = 'Pixelcraft — Design Systems & DX' LIMIT 1`, []
  )
  if (result.data[0]?.id) {
    redirect(`/campaigns/${result.data[0].id}/setup`)
  }
  return <div className="p-6 text-center text-slate-500">Demo not seeded. Run GET /api/seed-demo-campaign first.</div>
}
