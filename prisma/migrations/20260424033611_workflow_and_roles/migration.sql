/*
  Warnings:

  - The values [VIEWER] on the enum `UserRole` will be removed. If these variants are still used in the database, this will fail.
  - A unique constraint covering the columns `[employeeId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "IncrementRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'HR_REJECTED', 'HR_VERIFIED', 'RECTOR_SIGNED', 'FOUNDATION_REJECTED', 'FOUNDATION_APPROVED', 'ISSUED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('SKP', 'LAST_SK_BERKALA', 'TRIDHARMA_PROOF', 'SURAT_PENGANTAR', 'SK_BERKALA');

-- AlterEnum
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('ADMIN', 'HR', 'RECTOR', 'FOUNDATION', 'EMPLOYEE');
ALTER TABLE "public"."User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "public"."UserRole_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'EMPLOYEE';
COMMIT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "employeeId" TEXT,
ALTER COLUMN "role" SET DEFAULT 'EMPLOYEE';

-- CreateTable
CREATE TABLE "IncrementRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "status" "IncrementRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "currentSalary" INTEGER NOT NULL,
    "projectedNewSalary" INTEGER NOT NULL,
    "incrementAmount" INTEGER NOT NULL,
    "projectedEffectiveDate" TIMESTAMP(3) NOT NULL,
    "employeeNotes" TEXT,
    "submittedAt" TIMESTAMP(3),
    "hrReviewedAt" TIMESTAMP(3),
    "hrReviewedById" TEXT,
    "hrNotes" TEXT,
    "coverLetterNumber" TEXT,
    "coverLetterDate" TIMESTAMP(3),
    "rectorSignedAt" TIMESTAMP(3),
    "rectorSignedById" TEXT,
    "rectorNotes" TEXT,
    "foundationReviewedAt" TIMESTAMP(3),
    "foundationReviewedById" TEXT,
    "foundationNotes" TEXT,
    "decreeNumber" TEXT,
    "decreeDate" TIMESTAMP(3),
    "issuedAt" TIMESTAMP(3),
    "signedByName" TEXT,
    "signedByPosition" TEXT,
    "incrementHistoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncrementRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestDocument" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "kind" "DocumentKind" NOT NULL,
    "originalName" TEXT NOT NULL,
    "storedPath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedById" TEXT,

    CONSTRAINT "RequestDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IncrementRequest_coverLetterNumber_key" ON "IncrementRequest"("coverLetterNumber");

-- CreateIndex
CREATE UNIQUE INDEX "IncrementRequest_decreeNumber_key" ON "IncrementRequest"("decreeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "IncrementRequest_incrementHistoryId_key" ON "IncrementRequest"("incrementHistoryId");

-- CreateIndex
CREATE INDEX "IncrementRequest_employeeId_status_idx" ON "IncrementRequest"("employeeId", "status");

-- CreateIndex
CREATE INDEX "RequestDocument_requestId_kind_idx" ON "RequestDocument"("requestId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "User_employeeId_key" ON "User"("employeeId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncrementRequest" ADD CONSTRAINT "IncrementRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncrementRequest" ADD CONSTRAINT "IncrementRequest_hrReviewedById_fkey" FOREIGN KEY ("hrReviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncrementRequest" ADD CONSTRAINT "IncrementRequest_rectorSignedById_fkey" FOREIGN KEY ("rectorSignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncrementRequest" ADD CONSTRAINT "IncrementRequest_foundationReviewedById_fkey" FOREIGN KEY ("foundationReviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncrementRequest" ADD CONSTRAINT "IncrementRequest_incrementHistoryId_fkey" FOREIGN KEY ("incrementHistoryId") REFERENCES "IncrementHistory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestDocument" ADD CONSTRAINT "RequestDocument_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "IncrementRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestDocument" ADD CONSTRAINT "RequestDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
