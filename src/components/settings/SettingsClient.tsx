'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import { formatDateTime } from '@/lib/utils';
import Modal from '@/components/ui/Modal';

interface Integration {
  id: string; integration_key: string; is_configured: boolean;
  last_tested_at: string | null; last_test_result: string | null; last_test_message: string | null;
}

interface AppSettings {
  id: string; mask_pii_by_default: boolean; outreach_ready_score_threshold: number;
  min_evidence_coverage: string; default_ai_model: string;
}

interface Props {
  settings: AppSettings | null;
  integrations: Integration[];
  lastSeedRun: { seed_version: string; seeded_at: string; seeded_by_name: string; notes: string | null } | null;
}

const INTEGRATION_DESCRIPTIONS: Record<string, { label: string; description: string; icon: string }> = {
  anthropic: { label: 'Anthropic (Claude)', description: 'AI scoring, topic suggestions, outreach drafts', icon: 'ð¤' },
  youtube: { label: 'YouTube API', description: 'Creator discovery and channel search (V0: stubbed)', icon: 'â¶ï¸' },
  reddit: { label: 'Reddit API', description: 'Reddit thread monitoring (V0: stubbed)', icon: 'ð¡' },
  gumshoe: { label: 'Gumshoe Import', description: 'CSV import for prompts and citations', icon: 'ð' },
};

export default function SettingsClient({ settings, integrations, lastSeedRun }: Props) {
  const [clearModal, setClearModal] = useState(false);
  const [clearInput, setClearInput] = useState('');
  const [seeding, setSeeding] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(settings?.outreach_ready_score_threshold ?? 75);
  const [minCoverage, setMinCoverage] = useState(settings?.min_evidence_coverage ?? 'medium');
  const [maskPii, setMaskPii] = useState(settings?.mask_pii_by_default ?? true);
  const [savingSettings, setSavingSettings] = useState(false);
  const router = useRouter();
  const { addToast } = useToast();

  const handleSeedData = async () => {
    setSeeding(true);
    try {
      const res = await fetch('/api/seed', { method: 'POST' });
      const data = await res.json();
      if (data.ok || (data.errors && data.errors.length === 0)) {
        addToast('success', 'Demo data seeded successfully!');
        router.refresh();
      } else {
        const errorMsg = data.errors?.slice(0, 3).join('; ') || data.error || 'Seeding failed';
        addToast('warning', `Seeded with some issues: ${errorMsg}`);
        router.refresh();
      }
    } catch (err) {
      addToast('error', `Seed failed: ${err}`);
    } finally {
      setSeeding(false);
    }
  };

  const handleClearData = async () => {
    if (clearInput !== 'CLEAR') {
      addToast('error', 'Type CLEAR to confirm');
      return;
    }
    setClearing(true);
    try {
      const res = await fetch('/api/clear', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        addToast('success', 'All demo data cleared');
        setClearModal(false);
        setClearInput('');
        router.refresh();
      } else {
        addToast('error', data.errors?.join('; ') || 'Clear failed');
      }
    } finally {
      setClearing(false);
    }
  };

  const testIntegration = async (key: string) => {
    setTestingId(key);
    try {
      const res = await fetch('/api/integrations/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ integration_key: key }),
      });
      const data = await res.json();
      if (data.result === 'success') {
        addToast('success', `${key}: ${data.message}`);
      } else {
        addToast('error', `${key}: ${data.message}`);
      }
      router.refresh();
    } finally {
      setTestingId(null);
    }
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch('/api/settings/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threshold, min_coverage: minCoverage, mask_pii: maskPii }),
      });
      if (res.ok) {
        addToast('success', 'Settings saved');
        router.refresh();
      } else {
        addToast('error', 'Failed to save settings');
      }
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Integrations */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-800">Integrations</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {integrations.map(int => {
            const info = INTEGRATION_DESCRIPTIONS[int.integration_key] || { label: int.integration_key, description: '', icon: 'ð' };
            return (
              <div key={int.id} className="px-5 py-4 flex items-center gap-4">
                <div className="text-2xl">{info.icon}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{info.label}</span>
                    <span className={`badge text-xs ${int.is_configured ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                      {int.is_configured ? 'â Configured' : 'Not configured'}
                    </span>
                    {int.last_test_result && (
                      <span className={`badge text-xs ${int.last_test_result === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                        {int.last_test_result === 'success' ? 'â' : 'â'} {int.last_test_result}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{info.description}</p>
                  {int.last_test_message && (
                    <p className="text-xs text-gray-400 mt-0.5 font-mono">{int.last_test_message}</p>
                  )}
                  {int.last_tested_at && (
                    <p className="text-xs text-gray-400">Last tested: {formatDateTime(int.last_tested_at)}</p>
                  )}
                </div>
                <button
                  onClick={() => testIntegration(int.integration_key)}
                  disabled={testingId === int.integration_key}
                  className="btn-secondary text-xs"
                  aria-label={`Test ${info.label} connection`}
                >
                  {testingId === int.integration_key ? 'â³ Testingâ¦' : 'Test Connection'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Thresholds */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-800 mb-4">Scoring Thresholds</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Outreach-Ready Score Threshold (default: 75)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range" min="50" max="95" step="5"
                value={threshold}
                onChange={e => setThreshold(Number(e.target.value))}
                className="flex-1"
                aria-label="Score threshold"
              />
              <span className="font-mono font-bold text-lg text-accent w-8">{threshold}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Creators must score at or above this threshold to be outreach-ready.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Minimum Evidence Coverage
            </label>
            <select className="select-field max-w-xs" value={minCoverage} onChange={e => setMinCoverage(e.target.value)} aria-label="Minimum evidence coverage">
              <option value="strong">Strong (â¥6 snippets, â¥3 items, â¥3 dimensions)</option>
              <option value="medium">Medium (â¥3 snippets, â¥2 items, â¥2 dimensions)</option>
              <option value="weak">Weak (any snippets)</option>
            </select>
          </div>
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={maskPii}
                onChange={e => setMaskPii(e.target.checked)}
                className="rounded"
                aria-label="Mask PII by default"
              />
              <span className="text-xs font-medium text-gray-700">Mask PII by default</span>
            </label>
            <p className="text-xs text-gray-400 mt-0.5 ml-5">Contact information will be hidden until explicitly revealed.</p>
          </div>
          <button onClick={saveSettings} disabled={savingSettings} className="btn-primary text-xs">
            {savingSettings ? 'Savingâ¦' : 'â Save Thresholds'}
          </button>
        </div>
      </div>

      {/* Admin Tools */}
      <div className="card p-5 border-red-100">
        <h2 className="text-sm font-semibold text-gray-800 mb-1">Admin Tools</h2>
        <p className="text-xs text-gray-500 mb-4">Seed or clear demo data for testing. Does not drop tables.</p>

        {/* Last seed run info */}
        {lastSeedRun && (
          <div className="bg-green-50 border border-green-200 rounded-md p-3 mb-4">
            <p className="text-xs font-medium text-green-800">Last seed run:</p>
            <p className="text-xs text-green-700">{lastSeedRun.seed_version} Â· {formatDateTime(lastSeedRun.seeded_at)} Â· by {lastSeedRun.seeded_by_name}</p>
            {lastSeedRun.notes && <p className="text-xs text-green-600">{lastSeedRun.notes}</p>}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleSeedData}
            disabled={seeding}
            className="btn-primary"
            aria-label="Seed demo data"
          >
            {seeding ? (
              <span className="flex items-center gap-1.5"><span className="animate-spin">â³</span> Seedingâ¦</span>
            ) : 'ð± Seed Demo Data'}
          </button>
          <button
            onClick={() => setClearModal(true)}
            className="btn-danger"
            aria-label="Clear demo data"
          >
            ð Clear Demo Data
          </button>
        </div>
      </div>

      {/* Clear confirmation modal */}
      <Modal open={clearModal} onClose={() => { setClearModal(false); setClearInput(''); }} title="â ï¸ Clear Demo Data" size="sm">
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-xs font-semibold text-red-800">This will delete all rows from all domain tables.</p>
            <p className="text-xs text-red-700 mt-0.5">Tables are not dropped. You can re-seed after clearing. This action cannot be undone.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Type <strong>CLEAR</strong> to confirm:</label>
            <input
              className="input-field font-mono"
              value={clearInput}
              onChange={e => setClearInput(e.target.value)}
              placeholder="CLEAR"
              aria-label="Type CLEAR to confirm"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button className="btn-secondary" onClick={() => { setClearModal(false); setClearInput(''); }}>Cancel</button>
            <button
              className="btn-danger"
              onClick={handleClearData}
              disabled={clearInput !== 'CLEAR' || clearing}
              aria-label="Confirm clear data"
            >
              {clearing ? 'â³ Clearingâ¦' : 'ð Confirm Clear'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
