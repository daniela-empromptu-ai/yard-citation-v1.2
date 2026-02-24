import { dbQuery, t } from '@/lib/db';
import SettingsClient from '@/components/settings/SettingsClient';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const [settingsRes, integrationsRes, seedRunRes] = await Promise.all([
    dbQuery(`SELECT * FROM ${t('app_settings')} LIMIT 1`),
    dbQuery(`SELECT * FROM ${t('integration_status')} ORDER BY integration_key`),
    dbQuery(`
      SELECT dsr.*, u.name as seeded_by_name
      FROM ${t('demo_seed_runs')} dsr
      LEFT JOIN ${t('app_users')} u ON u.id = dsr.seeded_by_user_id
      ORDER BY dsr.seeded_at DESC LIMIT 1
    `),
  ]);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Integrations, thresholds, and admin tools</p>
      </div>
      <SettingsClient
        settings={settingsRes.data[0] || null}
        integrations={integrationsRes.data}
        lastSeedRun={seedRunRes.data[0] || null}
      />
    </div>
  );
}
