CREATE TABLE IF NOT EXISTS wlr_promotion_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL UNIQUE,
  project_id text NOT NULL,
  recipe_id uuid NULL,
  qualification_id uuid NULL,
  promotion_status text NOT NULL DEFAULT 'ready',
  destination_type text NOT NULL DEFAULT 'outreach_queue',
  notes text NULL,
  promoted_at timestamptz(6) NOT NULL DEFAULT now(),
  reviewed_at timestamptz(6) NULL,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wlr_promotion_queue_project_status_idx
  ON wlr_promotion_queue(project_id, promotion_status);

CREATE INDEX IF NOT EXISTS wlr_promotion_queue_recipe_promoted_idx
  ON wlr_promotion_queue(recipe_id, promoted_at DESC);
