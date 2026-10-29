-- CreateTable
CREATE TABLE "otps" (
    "email" VARCHAR(254) NOT NULL,
    "code_hash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otps_pkey" PRIMARY KEY ("email")
);

-- CreateIndex
CREATE INDEX "otps_expires_at_idx" ON "otps"("expires_at");

-- Hand-written
ALTER TABLE "otps"
  ADD CONSTRAINT "otps_email_lowercase_chk" CHECK ("email" = LOWER(TRIM("email"))),
  ADD CONSTRAINT "otps_attempts_chk" CHECK ("attempts" >= 0);
