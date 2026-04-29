-- CreateEnum
CREATE TYPE "OfficialRole" AS ENUM ('RECTOR', 'FOUNDATION_CHAIR');

-- AlterTable
ALTER TABLE "IncrementRequest" ADD COLUMN     "filedById" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "OrgOfficial" (
    "id" TEXT NOT NULL,
    "role" "OfficialRole" NOT NULL,
    "name" TEXT NOT NULL,
    "nip" TEXT,
    "title" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "OrgOfficial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrgOfficial_role_key" ON "OrgOfficial"("role");

-- AddForeignKey
ALTER TABLE "IncrementRequest" ADD CONSTRAINT "IncrementRequest_filedById_fkey" FOREIGN KEY ("filedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgOfficial" ADD CONSTRAINT "OrgOfficial_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
