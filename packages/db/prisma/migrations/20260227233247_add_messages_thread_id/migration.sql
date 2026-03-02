-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "thread_id" TEXT;

-- CreateIndex
CREATE INDEX "messages_thread_id_idx" ON "messages"("thread_id");
