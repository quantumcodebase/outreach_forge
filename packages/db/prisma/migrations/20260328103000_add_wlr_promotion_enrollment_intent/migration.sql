ALTER TABLE wlr_promotion_queue
  ADD COLUMN IF NOT EXISTS enrollment_intent text NOT NULL DEFAULT 'none';

CREATE INDEX IF NOT EXISTS wlr_promotion_queue_project_intent_idx
  ON wlr_promotion_queue(project_id, enrollment_intent);
