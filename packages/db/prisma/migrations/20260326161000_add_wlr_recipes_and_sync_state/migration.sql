CREATE TABLE IF NOT EXISTS wlr_search_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  offer_name TEXT NOT NULL,
  offer_type TEXT NOT NULL,
  icp_label TEXT NOT NULL,
  workflow_label TEXT NOT NULL,
  geography_label TEXT NOT NULL,
  cadence_type TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  confidence_threshold INTEGER NOT NULL DEFAULT 60,
  lead_cap INTEGER NOT NULL DEFAULT 200,
  settings_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_run_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_wlr_search_recipes_project_name ON wlr_search_recipes(project_id, name);
CREATE INDEX IF NOT EXISTS idx_wlr_search_recipes_project_enabled ON wlr_search_recipes(project_id, enabled);

CREATE TABLE IF NOT EXISTS wlr_sync_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  recipe_id UUID,
  last_synced_run_id TEXT,
  last_synced_at TIMESTAMPTZ,
  last_created_count INTEGER NOT NULL DEFAULT 0,
  last_updated_count INTEGER NOT NULL DEFAULT 0,
  last_skipped_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_wlr_sync_state_project_recipe ON wlr_sync_state(project_id, recipe_id);
CREATE INDEX IF NOT EXISTS idx_wlr_sync_state_project_last_synced ON wlr_sync_state(project_id, last_synced_at DESC);
