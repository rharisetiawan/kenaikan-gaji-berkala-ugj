-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'HR', 'VIEWER');

-- CreateEnum
CREATE TYPE "AcademicRankCode" AS ENUM ('ASISTEN_AHLI', 'LEKTOR', 'LEKTOR_KEPALA', 'GURU_BESAR');

-- CreateEnum
CREATE TYPE "EmployeeType" AS ENUM ('DOSEN', 'STAFF');

-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'RETIRED', 'RESIGNED');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "BkdStatus" AS ENUM ('PASS', 'FAIL', 'PENDING');

-- CreateEnum
CREATE TYPE "PerformanceRating" AS ENUM ('EXCELLENT', 'GOOD', 'SUFFICIENT', 'POOR', 'VERY_POOR');

-- CreateEnum
CREATE TYPE "IncrementStatus" AS ENUM ('PENDING', 'APPROVED', 'ISSUED', 'REJECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'HR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicRank" (
    "id" SERIAL NOT NULL,
    "code" "AcademicRankCode" NOT NULL,
    "name" TEXT NOT NULL,
    "minServiceYears" INTEGER NOT NULL,
    "functionalAllowance" INTEGER NOT NULL,

    CONSTRAINT "AcademicRank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayGrade" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseSalary" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,

    CONSTRAINT "PayGrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "nip" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "type" "EmployeeType" NOT NULL,
    "hireDate" TIMESTAMP(3) NOT NULL,
    "currentBaseSalary" INTEGER NOT NULL,
    "lastIncrementDate" TIMESTAMP(3),
    "nextIncrementDate" TIMESTAMP(3) NOT NULL,
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DosenDetail" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "nidn" TEXT NOT NULL,
    "academicRankId" INTEGER NOT NULL,
    "lastRankDate" TIMESTAMP(3),
    "faculty" TEXT NOT NULL,
    "studyProgram" TEXT NOT NULL,

    CONSTRAINT "DosenDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffDetail" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "payGradeId" INTEGER NOT NULL,
    "lastGradeDate" TIMESTAMP(3),
    "unit" TEXT NOT NULL,
    "position" TEXT NOT NULL,

    CONSTRAINT "StaffDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BkdEvaluation" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "semester" TEXT NOT NULL,
    "sksLoad" DOUBLE PRECISION NOT NULL,
    "status" "BkdStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BkdEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerformanceScore" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "rating" "PerformanceRating" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerformanceScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncrementHistory" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "previousSalary" INTEGER NOT NULL,
    "newSalary" INTEGER NOT NULL,
    "incrementAmount" INTEGER NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "decreeNumber" TEXT,
    "decreeDate" TIMESTAMP(3),
    "signedByName" TEXT,
    "signedByPosition" TEXT,
    "reason" TEXT,
    "status" "IncrementStatus" NOT NULL DEFAULT 'PENDING',
    "generatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncrementHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicRank_code_key" ON "AcademicRank"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PayGrade_code_key" ON "PayGrade"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_nip_key" ON "Employee"("nip");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_email_key" ON "Employee"("email");

-- CreateIndex
CREATE UNIQUE INDEX "DosenDetail_employeeId_key" ON "DosenDetail"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "DosenDetail_nidn_key" ON "DosenDetail"("nidn");

-- CreateIndex
CREATE UNIQUE INDEX "StaffDetail_employeeId_key" ON "StaffDetail"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "BkdEvaluation_employeeId_academicYear_semester_key" ON "BkdEvaluation"("employeeId", "academicYear", "semester");

-- CreateIndex
CREATE UNIQUE INDEX "PerformanceScore_employeeId_year_key" ON "PerformanceScore"("employeeId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "IncrementHistory_decreeNumber_key" ON "IncrementHistory"("decreeNumber");

-- AddForeignKey
ALTER TABLE "DosenDetail" ADD CONSTRAINT "DosenDetail_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DosenDetail" ADD CONSTRAINT "DosenDetail_academicRankId_fkey" FOREIGN KEY ("academicRankId") REFERENCES "AcademicRank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffDetail" ADD CONSTRAINT "StaffDetail_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffDetail" ADD CONSTRAINT "StaffDetail_payGradeId_fkey" FOREIGN KEY ("payGradeId") REFERENCES "PayGrade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BkdEvaluation" ADD CONSTRAINT "BkdEvaluation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceScore" ADD CONSTRAINT "PerformanceScore_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncrementHistory" ADD CONSTRAINT "IncrementHistory_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncrementHistory" ADD CONSTRAINT "IncrementHistory_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
