-- CreateTable
CREATE TABLE "Log" (
    "id" BIGSERIAL NOT NULL,
    "timestamp" TIMESTAMPTZ(3) NOT NULL,
    "level" VARCHAR(16) NOT NULL,
    "service" VARCHAR(100) NOT NULL,
    "message" TEXT NOT NULL,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "ingestedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Log_timestamp_id_idx" ON "Log"("timestamp", "id");

-- CreateIndex
CREATE INDEX "Log_service_timestamp_id_idx" ON "Log"("service", "timestamp", "id");

-- CreateIndex
CREATE INDEX "Log_level_timestamp_id_idx" ON "Log"("level", "timestamp", "id");
