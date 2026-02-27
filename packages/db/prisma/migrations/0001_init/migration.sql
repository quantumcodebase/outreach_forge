-- Create enums
CREATE TYPE "EmailAccountStatus" AS ENUM ('active', 'paused', 'error');
CREATE TYPE "LeadStatus" AS ENUM ('active', 'suppressed');
CREATE TYPE "SuppressionReason" AS ENUM ('bounce_hard', 'unsubscribe', 'manual', 'complaint');
CREATE TYPE "CampaignStatus" AS ENUM ('draft', 'active', 'paused', 'finished');
CREATE TYPE "EnrollmentStatus" AS ENUM ('active', 'replied', 'bounced', 'unsubscribed', 'finished', 'paused');
CREATE TYPE "MessageDirection" AS ENUM ('sent', 'received');
CREATE TYPE "EventType" AS ENUM ('sent', 'bounce_hard', 'bounce_soft', 'reply', 'unsubscribe', 'open');

CREATE TABLE "email_accounts" (
    "id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "imap_host" TEXT NOT NULL,
    "imap_port" INTEGER NOT NULL,
    "imap_user" TEXT NOT NULL,
    "smtp_host" TEXT NOT NULL,
    "smtp_port" INTEGER NOT NULL,
    "smtp_user" TEXT NOT NULL,
    "encrypted_pass" TEXT NOT NULL,
    "daily_cap" INTEGER NOT NULL DEFAULT 50,
    "sending_window_start" TIME(6) NOT NULL,
    "sending_window_end" TIME(6) NOT NULL,
    "timezone" TEXT NOT NULL,
    "status" "EmailAccountStatus" NOT NULL,
    "last_synced_at" TIMESTAMPTZ(6),
    "last_uid_synced" BIGINT,
    "bounce_count" INTEGER NOT NULL DEFAULT 0,
    "reply_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "email_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "company" TEXT,
    "title" TEXT,
    "city" TEXT,
    "tags" TEXT[] NOT NULL,
    "custom_fields" JSONB NOT NULL,
    "status" "LeadStatus" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "suppression_list" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "reason" "SuppressionReason" NOT NULL,
    "source_campaign_id" UUID,
    "added_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "suppression_list_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "campaigns" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "from_account_id" UUID NOT NULL,
    "daily_cap" INTEGER NOT NULL,
    "sending_window_start" TIME(6) NOT NULL,
    "sending_window_end" TIME(6) NOT NULL,
    "timezone" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "steps" (
    "id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "step_number" INTEGER NOT NULL,
    "subject_template" TEXT NOT NULL,
    "body_template" TEXT NOT NULL,
    "delay_days" INTEGER NOT NULL,
    CONSTRAINT "steps_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "enrollments" (
    "id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "current_step" INTEGER NOT NULL,
    "status" "EnrollmentStatus" NOT NULL,
    "enrolled_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_sent_at" TIMESTAMPTZ(6),
    "next_send_at" TIMESTAMPTZ(6),
    "thread_id" TEXT,
    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "enrollment_id" UUID,
    "step_id" UUID,
    "account_id" UUID NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "message_id_header" TEXT,
    "in_reply_to" TEXT,
    "references_header" TEXT,
    "subject" TEXT,
    "body_preview" VARCHAR(300),
    "sent_at" TIMESTAMPTZ(6),
    "received_at" TIMESTAMPTZ(6),
    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "lead_id" UUID,
    "campaign_id" UUID,
    "enrollment_id" UUID,
    "type" "EventType" NOT NULL,
    "metadata" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "leads_email_key" ON "leads"("email");
CREATE INDEX "suppression_list_email_idx" ON "suppression_list"("email");
CREATE UNIQUE INDEX "steps_campaign_id_step_number_key" ON "steps"("campaign_id", "step_number");
CREATE UNIQUE INDEX "enrollments_lead_id_campaign_id_key" ON "enrollments"("lead_id", "campaign_id");
CREATE INDEX "messages_message_id_header_idx" ON "messages"("message_id_header");
CREATE INDEX "events_type_created_at_idx" ON "events"("type", "created_at");

ALTER TABLE "suppression_list" ADD CONSTRAINT "suppression_list_source_campaign_id_fkey" FOREIGN KEY ("source_campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_from_account_id_fkey" FOREIGN KEY ("from_account_id") REFERENCES "email_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "steps" ADD CONSTRAINT "steps_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "messages" ADD CONSTRAINT "messages_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "messages" ADD CONSTRAINT "messages_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "messages" ADD CONSTRAINT "messages_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "email_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "events" ADD CONSTRAINT "events_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "events" ADD CONSTRAINT "events_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "events" ADD CONSTRAINT "events_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
