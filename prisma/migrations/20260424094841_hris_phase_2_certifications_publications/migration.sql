-- CreateEnum
CREATE TYPE "CertificationCategory" AS ENUM ('SERDOS', 'PROFESI', 'PELATIHAN', 'KEAHLIAN', 'BAHASA', 'LAINNYA');

-- CreateEnum
CREATE TYPE "PublicationKind" AS ENUM ('JURNAL_NASIONAL', 'JURNAL_NASIONAL_TERAKREDITASI', 'JURNAL_INTERNASIONAL', 'JURNAL_INTERNASIONAL_BEREPUTASI', 'PROSIDING_NASIONAL', 'PROSIDING_INTERNASIONAL', 'BUKU', 'BAB_BUKU', 'HKI', 'LAINNYA');

-- CreateEnum
CREATE TYPE "AuthorRole" AS ENUM ('FIRST_AUTHOR', 'CORRESPONDING_AUTHOR', 'COAUTHOR');

-- CreateTable
CREATE TABLE "Certification" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "category" "CertificationCategory" NOT NULL,
    "certificateNumber" TEXT,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "filePath" TEXT,
    "fileName" TEXT,
    "fileMimeType" TEXT,
    "fileSizeBytes" INTEGER,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Certification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Publication" (
    "id" TEXT NOT NULL,
    "dosenDetailId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" "PublicationKind" NOT NULL,
    "year" INTEGER NOT NULL,
    "venue" TEXT NOT NULL,
    "doi" TEXT,
    "url" TEXT,
    "authorRole" "AuthorRole" NOT NULL,
    "coauthors" TEXT,
    "sintaRank" TEXT,
    "scopusQuartile" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Publication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Certification_employeeId_idx" ON "Certification"("employeeId");

-- CreateIndex
CREATE INDEX "Certification_expiryDate_idx" ON "Certification"("expiryDate");

-- CreateIndex
CREATE INDEX "Publication_dosenDetailId_year_idx" ON "Publication"("dosenDetailId", "year");

-- CreateIndex
CREATE INDEX "Publication_kind_year_idx" ON "Publication"("kind", "year");

-- AddForeignKey
ALTER TABLE "Certification" ADD CONSTRAINT "Certification_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_dosenDetailId_fkey" FOREIGN KEY ("dosenDetailId") REFERENCES "DosenDetail"("id") ON DELETE CASCADE ON UPDATE CASCADE;
