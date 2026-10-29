-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "global_novels" ADD COLUMN     "cover_key" TEXT;

-- AlterTable
ALTER TABLE "novel_add_requests" ADD COLUMN     "cover_key" TEXT,
ADD COLUMN     "created_novel_id" UUID,
ADD COLUMN     "review_note" TEXT,
ADD COLUMN     "reviewed_at" TIMESTAMPTZ(3),
ADD COLUMN     "reviewed_by_id" UUID,
ADD COLUMN     "status" "RequestStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "novel_edit_requests" ADD COLUMN     "cover_key" TEXT,
ADD COLUMN     "original_values" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "review_note" TEXT,
ADD COLUMN     "reviewed_at" TIMESTAMPTZ(3),
ADD COLUMN     "reviewed_by_id" UUID,
ADD COLUMN     "status" "RequestStatus" NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "novel_add_requests_status_created_at_idx" ON "novel_add_requests"("status", "created_at");

-- CreateIndex
CREATE INDEX "novel_edit_requests_status_created_at_idx" ON "novel_edit_requests"("status", "created_at");

-- AddForeignKey
ALTER TABLE "novel_add_requests" ADD CONSTRAINT "novel_add_requests_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novel_add_requests" ADD CONSTRAINT "novel_add_requests_created_novel_id_fkey" FOREIGN KEY ("created_novel_id") REFERENCES "global_novels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novel_edit_requests" ADD CONSTRAINT "novel_edit_requests_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Hand-written constraints
-- ---------------------------------------------------------------------------

-- A pending request has no review; a reviewed one records who and when.
ALTER TABLE "novel_add_requests"
  ADD CONSTRAINT "novel_add_requests_review_chk" CHECK (
    ("status" = 'PENDING' AND "reviewed_at" IS NULL AND "reviewed_by_id" IS NULL)
    OR ("status" <> 'PENDING' AND "reviewed_at" IS NOT NULL)
  ),
  ADD CONSTRAINT "novel_add_requests_review_note_len_chk" CHECK (char_length("review_note") <= 500);

ALTER TABLE "novel_edit_requests"
  ADD CONSTRAINT "novel_edit_requests_review_chk" CHECK (
    ("status" = 'PENDING' AND "reviewed_at" IS NULL AND "reviewed_by_id" IS NULL)
    OR ("status" <> 'PENDING' AND "reviewed_at" IS NOT NULL)
  ),
  ADD CONSTRAINT "novel_edit_requests_review_note_len_chk" CHECK (char_length("review_note") <= 500);

-- One pending suggestion per title+author (case-insensitive).
CREATE UNIQUE INDEX "novel_add_requests_pending_title_author_key"
  ON "novel_add_requests" (LOWER("title"), LOWER("author"))
  WHERE "status" = 'PENDING';

-- One pending edit per person per novel.
CREATE UNIQUE INDEX "novel_edit_requests_pending_per_user_key"
  ON "novel_edit_requests" ("novel_id", "edited_by_id")
  WHERE "status" = 'PENDING';
