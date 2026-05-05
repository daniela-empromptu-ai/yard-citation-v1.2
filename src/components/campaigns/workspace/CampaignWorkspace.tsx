'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { ComingSoon } from '@/components/ui/ComingSoon';
import SetupTab from './SetupTab';
import DiscoveryTab from './DiscoveryTab';
import CreatorsTab from './CreatorsTab';

interface CampaignCreatorRow {
  id: string; creator_id: string; creator_name: string; creator_platform: string;
  creator_handle: string | null; source: string | null;
  creator_subscriber_count?: number | null;
  creator_categories?: string | null;
  pipeline_stage: string; scoring_status: string;
  overall_score: number | null; evidence_coverage: string | null;
  needs_manual_review: boolean | null; evaluated_at: string | null;
  updated_at: string; client_feedback: string | null; client_rating: string | null;
}

interface ActivityRow {
  id: string; event_type: string; actor_name: string | null; created_at: string;
  event_data_json: Record<string, unknown>; campaign_creator_id: string | null;
  creator_id: string | null;
}

interface PipelineJob {
  id: string; status: string; error_message: string | null;
  started_at: string | null; finished_at: string | null;
}

interface Props {
  campaign: {
    id: string; name: string; status: string; stage: string;
    geo_targets: string[]; product_category: string; creative_brief: string;
    language: string; client_name: string; owner_name: string;
    personas: string[]; gumshoe_notes: string | null;
    updated_at: string; owner_user_id: string;
  };
  topics: { id: string; campaign_id: string; topic: string; source: string; confidence: number | null; rationale: string | null; order_index: number; approved: boolean }[];
  searchTerms: { id: string; campaign_id: string; term: string; category_tag: string; why_it_helps: string; order_index: number; approved: boolean; approved_by_user_id: string | null; approved_at: string | null; notes: string | null }[];
  campaignCreators: CampaignCreatorRow[];
  activityLog: ActivityRow[];
  initialTab: string;
  pipelineJob?: PipelineJob | null;
}

const STEP_META: Record<string, { eyebrow: string; title: (campaignName: string) => string; subtitle: string }> = {
  setup: {
    eyebrow: 'Step 1 — Setup',
    title: (n) => `${n} setup`,
    subtitle: "Give us the brand and the brief. We'll run the visibility analysis next.",
  },
  analysis: {
    eyebrow: 'Step 2 — Analysis',
    title: () => 'Visibility analysis',
    subtitle: 'Where the brand stands across AI-cited sources.',
  },
  opportunities: {
    eyebrow: 'Step 3 — Opportunities',
    title: () => 'Pick what to act on',
    subtitle: "Select opportunities to queue for outreach. You'll review and approve the drafts next.",
  },
  outreach: {
    eyebrow: 'Step 4 — Outreach',
    title: () => 'Outreach queue',
    subtitle: 'Review each draft. Approve, edit, or skip. Nothing sends until you approve.',
  },
  production: {
    eyebrow: 'Step 5 — Production',
    title: () => 'Production board',
    subtitle: 'Live content moving through creation. Drag cards between stages as they progress.',
  },
  'client-view': {
    eyebrow: 'Step 6 — Client view',
    title: () => 'Client dashboard',
    subtitle: "What the client sees. Snapshot of visibility lift and live placements.",
  },
};

const STEP_ALIAS: Record<string, string> = {
  'search-terms': 'setup',
  discovery: 'analysis',
  engage: 'opportunities',
  creators: 'opportunities',
  activity: 'setup',
};

export default function CampaignWorkspace({
  campaign, topics, searchTerms, campaignCreators, activityLog, initialTab, pipelineJob,
}: Props) {
  const resolveStep = (raw: string) => STEP_ALIAS[raw] || raw || 'setup';
  const [step, setStep] = useState(resolveStep(initialTab));
  const [liveSearchTerms, setLiveSearchTerms] = useState(searchTerms);
  const [justStartedPipeline, setJustStartedPipeline] = useState(false);
  const router = useRouter();

  useEffect(() => { setLiveSearchTerms(searchTerms); }, [searchTerms]);
  useEffect(() => { setStep(resolveStep(initialTab)); }, [initialTab]);

  const pipelineRunning = pipelineJob?.status === 'queued' || pipelineJob?.status === 'running';
  const pipelineCompleted = pipelineJob?.status === 'completed';
  const pipelineRan = pipelineJob != null;
  const hasScoredCreators = campaignCreators.some(cc => cc.overall_score != null);

  useEffect(() => {
    if (pipelineRunning && justStartedPipeline) setJustStartedPipeline(false);
  }, [pipelineRunning, justStartedPipeline]);

  const handlePipelineStarted = () => {
    setJustStartedPipeline(true);
    setStep('analysis');
    router.replace(`/campaigns/${campaign.id}/analysis`, { scroll: false });
    router.refresh();
  };

  const handleDiscoveryComplete = () => {
    setStep('analysis');
    router.replace(`/campaigns/${campaign.id}/analysis`, { scroll: false });
    router.refresh();
  };

  const tabProps = { campaign, topics, searchTerms: liveSearchTerms, campaignCreators, activityLog };
  const meta = STEP_META[step] || STEP_META.setup;

  const renderStep = () => {
    switch (step) {
      case 'setup':
        return <SetupTab {...tabProps} onPipelineStarted={handlePipelineStarted} />;
      case 'analysis':
        if (pipelineRunning || justStartedPipeline) {
          return (
            <DiscoveryTab
              campaign={campaign}
              pipelineJob={pipelineJob}
              onComplete={handleDiscoveryComplete}
            />
          );
        }
        return (
          <ComingSoon
            title=""
            description="AI visibility score, category leaderboard, and gap topics — pulled from Gumshoe citation runs once the analysis is wired up."
          />
        );
      case 'opportunities':
        if (hasScoredCreators || pipelineCompleted) {
          return <CreatorsTab {...tabProps} pipelineJob={pipelineJob} />;
        }
        return (
          <ComingSoon
            title=""
            description="Qualified experts surfaced from the latest analysis run. Launch the analysis from Setup to populate this view."
          />
        );
      case 'outreach':
        return (
          <ComingSoon
            title=""
            description="Drafts queued for review. Stages: Draft → Sent → Replied → Booked → Live → Verified."
          />
        );
      case 'production':
        return (
          <ComingSoon
            title=""
            description="Kanban of live content moving through creation."
          />
        );
      case 'client-view':
        return (
          <ComingSoon
            title=""
            description="Snapshot view shared with the client."
          />
        );
      default:
        return null;
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow={meta.eyebrow}
        title={meta.title(campaign.name)}
        subtitle={meta.subtitle}
        actions={
          <div className="flex items-center gap-3 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider"
              style={{
                background: campaign.status === 'active' ? 'rgba(34,197,94,0.12)' : 'var(--bg-elevated)',
                color: campaign.status === 'active' ? '#4ade80' : 'var(--text-muted)',
              }}
            >
              {campaign.status}
            </span>
            <span>Owner: <span style={{ color: 'var(--text-primary)' }}>{campaign.owner_name}</span></span>
          </div>
        }
      />
      {renderStep()}
    </div>
  );
}
