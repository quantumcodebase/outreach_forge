ALTER TABLE wlr_search_recipes ADD COLUMN IF NOT EXISTS lifecycle_status TEXT;
ALTER TABLE wlr_search_recipes ADD COLUMN IF NOT EXISTS pending_run_id TEXT;
ALTER TABLE wlr_search_recipes ADD COLUMN IF NOT EXISTS pending_run_started_at TIMESTAMPTZ;
ALTER TABLE wlr_search_recipes ADD COLUMN IF NOT EXISTS last_synced_source_run_id TEXT;

CREATE TABLE IF NOT EXISTS lead_qualification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL UNIQUE,
  project_id TEXT NOT NULL,
  recipe_id UUID,
  signal_scope TEXT NOT NULL,
  pain_signal TEXT,
  change_signal TEXT,
  buildability_fit TEXT,
  stakeholder_label TEXT,
  proposed_wedge TEXT,
  pain_score INTEGER NOT NULL DEFAULT 0,
  workflow_score INTEGER NOT NULL DEFAULT 0,
  buying_motion_score INTEGER NOT NULL DEFAULT 0,
  buildability_score INTEGER NOT NULL DEFAULT 0,
  stakeholder_score INTEGER NOT NULL DEFAULT 0,
  total_score INTEGER NOT NULL DEFAULT 0,
  qualification_status TEXT NOT NULL DEFAULT 'nurture',
  rationale_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_qualification_project_status ON lead_qualification(project_id, qualification_status);
CREATE INDEX IF NOT EXISTS idx_lead_qualification_scope_score ON lead_qualification(signal_scope, total_score DESC);
