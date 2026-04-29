-- CreateTable
CREATE TABLE "AppSetting" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "letterheadUrl" TEXT,
    "incrementPercent" DOUBLE PRECISION NOT NULL DEFAULT 0.03,
    "staffMinPerformanceScore" INTEGER NOT NULL DEFAULT 76,
    "dosenRequiredBkdPasses" INTEGER NOT NULL DEFAULT 2,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("id")
);
