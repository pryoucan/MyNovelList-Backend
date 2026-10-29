-- Tags (e.g. from NovelUpdates): finer-grained than genres, up to 100 per novel.
ALTER TABLE "global_novels"
  ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD CONSTRAINT "global_novels_tags_chk" CHECK (CARDINALITY("tags") <= 100);

ALTER TABLE "novel_add_requests"
  ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD CONSTRAINT "novel_add_requests_tags_chk" CHECK (CARDINALITY("tags") <= 100);
