CREATE TABLE IF NOT EXISTS wlr_followup_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL UNIQUE,
  project_id text NOT NULL,
  recipe_id uuid NULL,
  qualification_id uuid NULL,
  promotion_id uuid NULL,
  followup_status text NOT NULL DEFAULT 'ready',
  destination_type text NOT NULL DEFAULT 'followup_queue',
  notes text NULL,
  queued_at timestamptz(6) NOT NULL DEFAULT now(),
  reviewed_at timestamptz(6) NULL,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wlr_followup_queue_project_status_idx
  ON wlr_followup_queue(project_id, followup_status);

CREATE INDEX IF NOT EXISTS wlr_followup_queue_recipe_queued_idx
  ON wlr_followup_queue(recipe_id, queued_at DESC);
