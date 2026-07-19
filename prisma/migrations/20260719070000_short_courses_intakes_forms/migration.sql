-- CreateEnum
CREATE TYPE "ShortCourseRegStatus" AS ENUM ('PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FormStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');

-- AlterEnum
ALTER TYPE "InvoiceKind" ADD VALUE 'SHORT_COURSE';

-- AlterTable
ALTER TABLE "Programme" ADD COLUMN     "admissionClosesDay" INTEGER,
ADD COLUMN     "admissionClosesMonth" INTEGER,
ADD COLUMN     "cohortStartsDay" INTEGER,
ADD COLUMN     "cohortStartsMonth" INTEGER;

-- CreateTable
CREATE TABLE "ShortCourse" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "trainingWindow" TEXT NOT NULL,
    "registrationCloses" TEXT NOT NULL,
    "feePesewas" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ShortCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShortCourseRegistration" (
    "id" TEXT NOT NULL,
    "shortCourseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phone" TEXT,
    "status" "ShortCourseRegStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "invoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "ShortCourseRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormDef" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "FormStatus" NOT NULL DEFAULT 'DRAFT',
    "fields" JSONB NOT NULL DEFAULT '[]',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormDef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormResponse" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "userId" TEXT,
    "respondentName" TEXT,
    "respondentEmail" TEXT,
    "answers" JSONB NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShortCourse_code_key" ON "ShortCourse"("code");

-- CreateIndex
CREATE INDEX "ShortCourseRegistration_shortCourseId_status_idx" ON "ShortCourseRegistration"("shortCourseId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ShortCourseRegistration_shortCourseId_userId_key" ON "ShortCourseRegistration"("shortCourseId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "FormDef_slug_key" ON "FormDef"("slug");

-- CreateIndex
CREATE INDEX "FormResponse_formId_submittedAt_idx" ON "FormResponse"("formId", "submittedAt");

-- AddForeignKey
ALTER TABLE "ShortCourseRegistration" ADD CONSTRAINT "ShortCourseRegistration_shortCourseId_fkey" FOREIGN KEY ("shortCourseId") REFERENCES "ShortCourse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShortCourseRegistration" ADD CONSTRAINT "ShortCourseRegistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormResponse" ADD CONSTRAINT "FormResponse_formId_fkey" FOREIGN KEY ("formId") REFERENCES "FormDef"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormResponse" ADD CONSTRAINT "FormResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

