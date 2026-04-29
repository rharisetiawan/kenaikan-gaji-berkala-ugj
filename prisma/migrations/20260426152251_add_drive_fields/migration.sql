-- AlterTable
ALTER TABLE "AppSetting" ADD COLUMN     "letterheadDriveFileId" TEXT;

-- AlterTable
ALTER TABLE "Certification" ADD COLUMN     "driveFileId" TEXT,
ADD COLUMN     "driveWebViewLink" TEXT;

-- AlterTable
ALTER TABLE "RequestDocument" ADD COLUMN     "driveFileId" TEXT,
ADD COLUMN     "driveWebViewLink" TEXT;
