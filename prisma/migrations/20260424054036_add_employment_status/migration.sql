-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('TETAP', 'KONTRAK', 'HONORER');

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "employmentStatus" "EmploymentStatus" NOT NULL DEFAULT 'TETAP';
