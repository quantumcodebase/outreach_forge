ALTER TABLE wlr_search_recipes ADD COLUMN IF NOT EXISTS next_run_at TIMESTAMPTZ;
ALTER TABLE wlr_search_recipes ADD COLUMN IF NOT EXISTS last_scheduled_run_at TIMESTAMPTZ;
ALTER TABLE wlr_search_recipes ADD COLUMN IF NOT EXISTS last_run_origin TEXT;
ALTER TABLE wlr_search_recipes ADD COLUMN IF NOT EXISTS last_success_at TIMESTAMPTZ;
ALTER TABLE wlr_search_recipes ADD COLUMN IF NOT EXISTS last_failure_at TIMESTAMPTZ;
ALTER TABLE wlr_search_recipes ADD COLUMN IF NOT EXISTS last_failure_message TEXT;

CREATE TABLE IF NOT EXISTS wlr_scheduler_state (
  project_id TEXT PRIMARY KEY,
  last_tick_at TIMESTAMPTZ,
  last_tick_ok BOOLEAN NOT NULL DEFAULT TRUE,
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
