CREATE TABLE "review_likes" (
    "user_id" UUID NOT NULL,
    "review_id" UUID NOT NULL,
    CONSTRAINT "review_likes_pkey" PRIMARY KEY ("user_id", "review_id")
);
CREATE INDEX "review_likes_review_id_idx" ON "review_likes"("review_id");
ALTER TABLE "review_likes" ADD CONSTRAINT "review_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "review_likes" ADD CONSTRAINT "review_likes_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "novel_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "review_replies" (
    "id" UUID NOT NULL,
    "review_id" UUID NOT NULL,
    "parent_id" UUID,
    "user_id" UUID NOT NULL,
    "body" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "edited_at" TIMESTAMPTZ(3),
    "deleted_at" TIMESTAMPTZ(3),
    CONSTRAINT "review_replies_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "review_replies_body_chk" CHECK (("deleted_at" IS NULL AND "body" IS NOT NULL AND CHAR_LENGTH(TRIM("body")) BETWEEN 1 AND 2000) OR ("deleted_at" IS NOT NULL AND "body" IS NULL))
);
CREATE INDEX "review_replies_review_id_created_at_idx" ON "review_replies"("review_id", "created_at");
CREATE INDEX "review_replies_parent_id_idx" ON "review_replies"("parent_id");
ALTER TABLE "review_replies" ADD CONSTRAINT "review_replies_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "novel_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "review_replies" ADD CONSTRAINT "review_replies_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "review_replies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "review_replies" ADD CONSTRAINT "review_replies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "review_reply_likes" (
    "user_id" UUID NOT NULL,
    "reply_id" UUID NOT NULL,
    CONSTRAINT "review_reply_likes_pkey" PRIMARY KEY ("user_id", "reply_id")
);
CREATE INDEX "review_reply_likes_reply_id_idx" ON "review_reply_likes"("reply_id");
ALTER TABLE "review_reply_likes" ADD CONSTRAINT "review_reply_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "review_reply_likes" ADD CONSTRAINT "review_reply_likes_reply_id_fkey" FOREIGN KEY ("reply_id") REFERENCES "review_replies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
