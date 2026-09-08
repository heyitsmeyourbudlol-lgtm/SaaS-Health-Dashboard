-- AlterTable
ALTER TABLE "Agency" ADD COLUMN "alertWebhookUrl" TEXT;

-- AlterTable
ALTER TABLE "Client" ADD COLUMN "latestErrorCount" INTEGER;
ALTER TABLE "Client" ADD COLUMN "latestSyntheticsPct" REAL;

-- CreateTable
CREATE TABLE "AlertEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "sent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AlertEvent_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AlertEvent_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AlertEvent_agencyId_createdAt_idx" ON "AlertEvent"("agencyId", "createdAt");

-- CreateIndex
CREATE INDEX "AlertEvent_clientId_idx" ON "AlertEvent"("clientId");
