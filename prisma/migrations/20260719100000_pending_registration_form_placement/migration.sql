-- CreateEnum
CREATE TYPE "FormType" AS ENUM ('GENERIC', 'ADMISSION');

-- CreateEnum
CREATE TYPE "FormPlacement" AS ENUM ('LINK_ONLY', 'PUBLIC_NAV', 'APPLICANT_PORTAL');

-- CreateEnum
CREATE TYPE "PendingRegStatus" AS ENUM ('PENDING', 'COMPLETED', 'EXPIRED');

-- AlterTable
ALTER TABLE "FormDef" ADD COLUMN     "placement" "FormPlacement" NOT NULL DEFAULT 'LINK_ONLY',
ADD COLUMN     "type" "FormType" NOT NULL DEFAULT 'GENERIC';

-- CreateTable
CREATE TABLE "PendingRegistration" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reference" TEXT NOT NULL,
    "serial" TEXT NOT NULL,
    "pin" TEXT NOT NULL,
    "status" "PendingRegStatus" NOT NULL DEFAULT 'PENDING',
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "PendingRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PendingRegistration_reference_key" ON "PendingRegistration"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "PendingRegistration_serial_key" ON "PendingRegistration"("serial");

-- CreateIndex
CREATE INDEX "PendingRegistration_email_idx" ON "PendingRegistration"("email");

-- CreateIndex
CREATE INDEX "PendingRegistration_status_idx" ON "PendingRegistration"("status");

