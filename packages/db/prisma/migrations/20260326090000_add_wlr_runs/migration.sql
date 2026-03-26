CREATE TABLE IF NOT EXISTS wlr_runs (
  run_id TEXT PRIMARY KEY,
  project_id TEXT,
  status TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  discovered INTEGER,
  enriched INTEGER,
  deduped INTEGER,
  error TEXT,
  notes TEXT,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wlr_runs_project_started ON wlr_runs(project_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_wlr_runs_status_started ON wlr_runs(status, started_at DESC);
