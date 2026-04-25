-- AlterTable
ALTER TABLE "job_items" ADD COLUMN "opportunityId" TEXT;

-- CreateTable
CREATE TABLE "opportunities" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'new_lead',
    "stageHistory" TEXT NOT NULL DEFAULT '[]',
    "lostReason" TEXT,
    "daysInCurrentStage" INTEGER,
    "sourceId" TEXT NOT NULL,
    "sourceLeadId" TEXT,
    "serviceAreaId" TEXT,
    "customerId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT,
    "customerEmail" TEXT,
    "serviceCategory" TEXT NOT NULL,
    "description" TEXT,
    "addressLine" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "conversationId" TEXT,
    "jobNumber" TEXT,
    "propertyId" TEXT,
    "scheduledStart" DATETIME,
    "scheduledEnd" DATETIME,
    "durationEstimateMinutes" INTEGER,
    "technicianId" TEXT,
    "dispatcherId" TEXT,
    "actualStart" DATETIME,
    "actualEnd" DATETIME,
    "estimateAmount" REAL,
    "finalAmount" REAL,
    "laborCost" REAL,
    "partsCost" REAL,
    "customerRating" INTEGER,
    "customerReview" TEXT,
    "internalNotes" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "qualifiedAt" DATETIME,
    "jobCreatedAt" DATETIME,
    "scheduledAt" DATETIME,
    "doneAt" DATETIME,
    "paidAt" DATETIME,
    "lostAt" DATETIME,
    "enteredCurrentStageAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "legacyLeadId" TEXT,
    "legacyJobId" TEXT,
    CONSTRAINT "opportunities_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "opportunities_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "opportunities_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "opportunities_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "technicians" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "opportunities_dispatcherId_fkey" FOREIGN KEY ("dispatcherId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "opportunity_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "qty" REAL NOT NULL,
    "unitPrice" REAL NOT NULL,
    "total" REAL NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "opportunity_items_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "opportunity_items_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_calls" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "customerId" TEXT,
    "leadId" TEXT,
    "jobId" TEXT,
    "opportunityId" TEXT,
    "direction" TEXT NOT NULL,
    "fromNumber" TEXT NOT NULL,
    "toNumber" TEXT NOT NULL,
    "twilioCallSid" TEXT,
    "vapiCallId" TEXT,
    "durationSeconds" INTEGER,
    "recordingUrl" TEXT,
    "transcription" TEXT,
    "sentimentScore" REAL,
    "extractedFacts" TEXT,
    "aiSummary" TEXT,
    "startedAt" DATETIME NOT NULL,
    "endedAt" DATETIME,
    CONSTRAINT "calls_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "calls_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "calls_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "calls_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_calls" ("aiSummary", "customerId", "direction", "durationSeconds", "endedAt", "extractedFacts", "fromNumber", "id", "jobId", "leadId", "orgId", "recordingUrl", "sentimentScore", "startedAt", "toNumber", "transcription", "twilioCallSid", "vapiCallId") SELECT "aiSummary", "customerId", "direction", "durationSeconds", "endedAt", "extractedFacts", "fromNumber", "id", "jobId", "leadId", "orgId", "recordingUrl", "sentimentScore", "startedAt", "toNumber", "transcription", "twilioCallSid", "vapiCallId" FROM "calls";
DROP TABLE "calls";
ALTER TABLE "new_calls" RENAME TO "calls";
CREATE UNIQUE INDEX "calls_twilioCallSid_key" ON "calls"("twilioCallSid");
CREATE UNIQUE INDEX "calls_vapiCallId_key" ON "calls"("vapiCallId");
CREATE INDEX "calls_opportunityId_idx" ON "calls"("opportunityId");
CREATE TABLE "new_estimates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "opportunityId" TEXT,
    "customerId" TEXT NOT NULL,
    "estimateNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "subtotal" REAL NOT NULL,
    "tax" REAL NOT NULL,
    "total" REAL NOT NULL,
    "validUntil" DATETIME NOT NULL,
    "approvalToken" TEXT,
    "approvedAt" DATETIME,
    "rejectedAt" DATETIME,
    "sentAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "estimates_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "estimates_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "estimates_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "estimates_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_estimates" ("approvalToken", "approvedAt", "createdAt", "customerId", "estimateNumber", "id", "jobId", "notes", "orgId", "rejectedAt", "sentAt", "status", "subtotal", "tax", "total", "validUntil") SELECT "approvalToken", "approvedAt", "createdAt", "customerId", "estimateNumber", "id", "jobId", "notes", "orgId", "rejectedAt", "sentAt", "status", "subtotal", "tax", "total", "validUntil" FROM "estimates";
DROP TABLE "estimates";
ALTER TABLE "new_estimates" RENAME TO "estimates";
CREATE UNIQUE INDEX "estimates_estimateNumber_key" ON "estimates"("estimateNumber");
CREATE UNIQUE INDEX "estimates_approvalToken_key" ON "estimates"("approvalToken");
CREATE INDEX "estimates_opportunityId_idx" ON "estimates"("opportunityId");
CREATE TABLE "new_invoices" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "opportunityId" TEXT,
    "customerId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "subtotal" REAL NOT NULL,
    "tax" REAL NOT NULL,
    "total" REAL NOT NULL,
    "amountPaid" REAL NOT NULL DEFAULT 0,
    "dueDate" DATETIME NOT NULL,
    "stripeInvoiceId" TEXT,
    "sentAt" DATETIME,
    "paidAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "invoices_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "invoices_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "invoices_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "invoices_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_invoices" ("amountPaid", "createdAt", "customerId", "dueDate", "id", "invoiceNumber", "jobId", "orgId", "paidAt", "sentAt", "status", "stripeInvoiceId", "subtotal", "tax", "total") SELECT "amountPaid", "createdAt", "customerId", "dueDate", "id", "invoiceNumber", "jobId", "orgId", "paidAt", "sentAt", "status", "stripeInvoiceId", "subtotal", "tax", "total" FROM "invoices";
DROP TABLE "invoices";
ALTER TABLE "new_invoices" RENAME TO "invoices";
CREATE UNIQUE INDEX "invoices_invoiceNumber_key" ON "invoices"("invoiceNumber");
CREATE UNIQUE INDEX "invoices_stripeInvoiceId_key" ON "invoices"("stripeInvoiceId");
CREATE INDEX "invoices_opportunityId_idx" ON "invoices"("opportunityId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "opportunities_conversationId_key" ON "opportunities"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "opportunities_jobNumber_key" ON "opportunities"("jobNumber");

-- CreateIndex
CREATE UNIQUE INDEX "opportunities_legacyLeadId_key" ON "opportunities"("legacyLeadId");

-- CreateIndex
CREATE UNIQUE INDEX "opportunities_legacyJobId_key" ON "opportunities"("legacyJobId");

-- CreateIndex
CREATE INDEX "opportunities_orgId_stage_lastActivityAt_idx" ON "opportunities"("orgId", "stage", "lastActivityAt");

-- CreateIndex
CREATE INDEX "opportunities_orgId_sourceId_createdAt_idx" ON "opportunities"("orgId", "sourceId", "createdAt");

-- CreateIndex
CREATE INDEX "opportunities_orgId_technicianId_scheduledStart_idx" ON "opportunities"("orgId", "technicianId", "scheduledStart");

-- CreateIndex
CREATE INDEX "opportunities_orgId_customerId_idx" ON "opportunities"("orgId", "customerId");

-- CreateIndex
CREATE INDEX "opportunity_items_opportunityId_idx" ON "opportunity_items"("opportunityId");

-- CreateIndex
CREATE INDEX "opportunity_items_orgId_idx" ON "opportunity_items"("orgId");

-- CreateIndex
CREATE INDEX "job_items_opportunityId_idx" ON "job_items"("opportunityId");
