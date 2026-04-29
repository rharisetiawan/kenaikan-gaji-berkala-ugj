/*
  Warnings:

  - A unique constraint covering the columns `[nidk]` on the table `DosenDetail` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[nik]` on the table `Employee` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "LastEducation" AS ENUM ('SD', 'SMP', 'SMA', 'D3', 'S1', 'S2', 'S3');

-- CreateEnum
CREATE TYPE "MaritalStatus" AS ENUM ('BELUM_KAWIN', 'KAWIN', 'CERAI_HIDUP', 'CERAI_MATI');

-- CreateEnum
CREATE TYPE "Religion" AS ENUM ('ISLAM', 'KRISTEN', 'KATOLIK', 'HINDU', 'BUDDHA', 'KONGHUCU');

-- AlterTable
ALTER TABLE "DosenDetail" ADD COLUMN     "googleScholarId" TEXT,
ADD COLUMN     "nidk" TEXT,
ADD COLUMN     "orcid" TEXT,
ADD COLUMN     "scopusId" TEXT,
ADD COLUMN     "sintaId" TEXT;

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "dependentsCount" INTEGER,
ADD COLUMN     "emergencyContact" TEXT,
ADD COLUMN     "lastEducation" "LastEducation",
ADD COLUMN     "maritalStatus" "MaritalStatus",
ADD COLUMN     "nik" TEXT,
ADD COLUMN     "placeOfBirth" TEXT,
ADD COLUMN     "profileUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "religion" "Religion";

-- CreateIndex
CREATE UNIQUE INDEX "DosenDetail_nidk_key" ON "DosenDetail"("nidk");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_nik_key" ON "Employee"("nik");
