CREATE TABLE "novel_reviews" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "novel_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "is_spoiler" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "edited_at" TIMESTAMPTZ(3),
    CONSTRAINT "novel_reviews_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "novel_reviews_user_id_novel_id_key" ON "novel_reviews"("user_id", "novel_id");
CREATE INDEX "novel_reviews_novel_id_created_at_idx" ON "novel_reviews"("novel_id", "created_at");
ALTER TABLE "novel_reviews" ADD CONSTRAINT "novel_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "novel_reviews" ADD CONSTRAINT "novel_reviews_novel_id_fkey" FOREIGN KEY ("novel_id") REFERENCES "global_novels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
