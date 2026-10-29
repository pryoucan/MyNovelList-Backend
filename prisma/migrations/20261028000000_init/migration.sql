-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "username" VARCHAR(20) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "phone_number" VARCHAR(20),
    "is_email_verified" BOOLEAN NOT NULL DEFAULT true,
    "avatar_key" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "global_novels" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "original_title" TEXT,
    "author" TEXT NOT NULL,
    "original_language" VARCHAR(2) NOT NULL,
    "is_fully_translated" BOOLEAN NOT NULL DEFAULT false,
    "publisher_original" TEXT,
    "publisher_english" TEXT,
    "publication_status" TEXT NOT NULL,
    "start_year" INTEGER,
    "end_year" INTEGER,
    "chapter_count" INTEGER,
    "cover_image" TEXT,
    "synopsis" TEXT,
    "genres" TEXT[],
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "global_novels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "novel_add_requests" (
    "id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "original_title" TEXT,
    "author" TEXT NOT NULL,
    "original_language" VARCHAR(2) NOT NULL,
    "is_fully_translated" BOOLEAN NOT NULL DEFAULT false,
    "publisher_original" TEXT,
    "publisher_english" TEXT,
    "publication_status" TEXT NOT NULL,
    "start_year" INTEGER,
    "end_year" INTEGER,
    "chapter_count" INTEGER,
    "cover_image" TEXT,
    "synopsis" TEXT,
    "genres" TEXT[],
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "novel_add_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "novel_edit_requests" (
    "id" UUID NOT NULL,
    "novel_id" UUID NOT NULL,
    "edited_by_id" UUID NOT NULL,
    "updated_fields" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "novel_edit_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_novels" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "novel_id" UUID NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "rating" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'Reading',
    "started_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_novels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "novel_add_requests_created_by_id_idx" ON "novel_add_requests"("created_by_id");

-- CreateIndex
CREATE INDEX "novel_edit_requests_novel_id_idx" ON "novel_edit_requests"("novel_id");

-- CreateIndex
CREATE INDEX "novel_edit_requests_edited_by_id_idx" ON "novel_edit_requests"("edited_by_id");

-- CreateIndex
CREATE INDEX "user_novels_novel_id_idx" ON "user_novels"("novel_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_novels_user_id_novel_id_key" ON "user_novels"("user_id", "novel_id");

-- AddForeignKey
ALTER TABLE "novel_add_requests" ADD CONSTRAINT "novel_add_requests_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novel_edit_requests" ADD CONSTRAINT "novel_edit_requests_novel_id_fkey" FOREIGN KEY ("novel_id") REFERENCES "global_novels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novel_edit_requests" ADD CONSTRAINT "novel_edit_requests_edited_by_id_fkey" FOREIGN KEY ("edited_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_novels" ADD CONSTRAINT "user_novels_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_novels" ADD CONSTRAINT "user_novels_novel_id_fkey" FOREIGN KEY ("novel_id") REFERENCES "global_novels"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Hand-written constraints (not expressible in schema.prisma)
-- ---------------------------------------------------------------------------

-- users: usernames are unique ignoring case ("Harsh" and "harsh" can't both exist),
-- emails are always stored lowercase.
CREATE UNIQUE INDEX "users_username_lower_key" ON "users" (LOWER("username"));
ALTER TABLE "users"
  ADD CONSTRAINT "users_username_format_chk" CHECK ("username" ~ '^[A-Za-z0-9_]{3,20}$'),
  ADD CONSTRAINT "users_email_lowercase_chk" CHECK ("email" = LOWER(TRIM("email")));

-- global_novels: the same title by the same author can only exist once (case-insensitive).
CREATE UNIQUE INDEX "global_novels_title_author_lower_key"
  ON "global_novels" (LOWER("title"), LOWER("author"));

ALTER TABLE "global_novels"
  ALTER COLUMN "genres" SET NOT NULL,
  ADD CONSTRAINT "global_novels_language_chk" CHECK ("original_language" IN ('zh', 'en')),
  ADD CONSTRAINT "global_novels_publisher_original_chk" CHECK ("publisher_original" IN ('Qidian', 'Zongheng', 'Jinjiang', '17K')),
  ADD CONSTRAINT "global_novels_publisher_english_chk" CHECK ("publisher_english" IN ('Wuxiaworld', 'Web Novel')),
  ADD CONSTRAINT "global_novels_status_chk" CHECK ("publication_status" IN ('Ongoing', 'Completed', 'Upcoming', 'On Hiatus', 'Cancelled')),
  ADD CONSTRAINT "global_novels_chapter_count_chk" CHECK ("chapter_count" >= 0),
  ADD CONSTRAINT "global_novels_years_chk" CHECK ("end_year" IS NULL OR "start_year" IS NULL OR "end_year" >= "start_year"),
  ADD CONSTRAINT "global_novels_genres_chk" CHECK (CARDINALITY("genres") >= 1);

ALTER TABLE "novel_add_requests"
  ALTER COLUMN "genres" SET NOT NULL,
  ADD CONSTRAINT "novel_add_requests_language_chk" CHECK ("original_language" IN ('zh', 'en')),
  ADD CONSTRAINT "novel_add_requests_publisher_original_chk" CHECK ("publisher_original" IN ('Qidian', 'Zongheng', 'Jinjiang', '17K')),
  ADD CONSTRAINT "novel_add_requests_publisher_english_chk" CHECK ("publisher_english" IN ('Wuxiaworld', 'Web Novel')),
  ADD CONSTRAINT "novel_add_requests_status_chk" CHECK ("publication_status" IN ('Ongoing', 'Completed', 'Upcoming', 'On Hiatus', 'Cancelled')),
  ADD CONSTRAINT "novel_add_requests_chapter_count_chk" CHECK ("chapter_count" >= 0),
  ADD CONSTRAINT "novel_add_requests_years_chk" CHECK ("end_year" IS NULL OR "start_year" IS NULL OR "end_year" >= "start_year"),
  ADD CONSTRAINT "novel_add_requests_genres_chk" CHECK (CARDINALITY("genres") >= 1);

-- user_novels: valid status, non-negative progress, rating 1-10 in 0.5 steps.
ALTER TABLE "user_novels"
  ADD CONSTRAINT "user_novels_status_chk" CHECK ("status" IN ('Reading', 'Completed', 'On Hold', 'Plan To Read', 'Dropped')),
  ADD CONSTRAINT "user_novels_progress_chk" CHECK ("progress" >= 0),
  ADD CONSTRAINT "user_novels_rating_chk" CHECK ("rating" IS NULL OR ("rating" BETWEEN 1 AND 10 AND "rating" * 2 = FLOOR("rating" * 2))),
  ADD CONSTRAINT "user_novels_completed_chk" CHECK ("status" <> 'Completed' OR "completed_at" IS NOT NULL);
