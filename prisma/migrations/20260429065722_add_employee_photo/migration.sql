-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "photoDriveFileId" TEXT,
ADD COLUMN     "photoDriveWebViewLink" TEXT,
ADD COLUMN     "photoMimeType" TEXT,
ADD COLUMN     "photoSizeBytes" INTEGER,
ADD COLUMN     "photoStoredPath" TEXT;
