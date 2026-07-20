-- CreateEnum
CREATE TYPE "TshirtSize" AS ENUM ('S', 'M', 'L', 'XL', 'XXL');

-- CreateEnum
CREATE TYPE "AccommodationChoice" AS ENUM ('YES', 'NO', 'NOT_SURE');

-- CreateEnum
CREATE TYPE "EducationLevel" AS ENUM ('WASSCE', 'DIPLOMA', 'HND', 'DEGREE', 'OTHER');

-- CreateEnum
CREATE TYPE "ExperienceLevel" AS ENUM ('NONE', 'MONTHS_0_6', 'MONTHS_6_24', 'YEARS_2_PLUS');

-- CreateEnum
CREATE TYPE "SponsorshipType" AS ENUM ('SELF', 'COMPANY', 'NGO');

-- CreateEnum
CREATE TYPE "ReferralSource" AS ENUM ('FACEBOOK', 'WHATSAPP', 'FRIEND', 'RADIO', 'ECG', 'OTHER');

-- CreateEnum
CREATE TYPE "ShortCourseDocKind" AS ENUM ('CV', 'CERTIFICATE', 'PHOTO', 'ID_DOCUMENT', 'OTHER');

-- AlterTable
-- durationWeeks backfills existing rows via a temporary default (the old
-- trainingWindow/registrationCloses text columns they came from are being
-- dropped in the same statement, so there is no real value to migrate from);
-- the default is dropped immediately after so new rows must supply it, as
-- the schema (no @default) expects.
ALTER TABLE "ShortCourse" DROP COLUMN "registrationCloses",
DROP COLUMN "trainingWindow",
ADD COLUMN     "durationWeeks" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "ShortCourse" ALTER COLUMN "durationWeeks" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ShortCourseRegistration" ADD COLUMN     "accommodation" "AccommodationChoice",
ADD COLUMN     "batchId" TEXT,
ADD COLUMN     "bloodGroup" TEXT,
ADD COLUMN     "currentAddress" TEXT,
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "declarationAccepted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "declarationName" TEXT,
ADD COLUMN     "declarationSignedAt" TIMESTAMP(3),
ADD COLUMN     "educationLevel" "EducationLevel",
ADD COLUMN     "educationOther" TEXT,
ADD COLUMN     "emergencyEmail" TEXT,
ADD COLUMN     "emergencyName" TEXT,
ADD COLUMN     "emergencyPhone" TEXT,
ADD COLUMN     "emergencyRelationship" TEXT,
ADD COLUMN     "experienceLevel" "ExperienceLevel",
ADD COLUMN     "experienceNote" TEXT,
ADD COLUMN     "fullDuration" BOOLEAN,
ADD COLUMN     "fullName" TEXT,
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "homeRegion" TEXT,
ADD COLUMN     "idNumber" TEXT,
ADD COLUMN     "medicalConditions" TEXT,
ADD COLUMN     "partialDurationNote" TEXT,
ADD COLUMN     "refNo" TEXT,
ADD COLUMN     "referralOther" TEXT,
ADD COLUMN     "referralSource" "ReferralSource",
ADD COLUMN     "sponsorName" TEXT,
ADD COLUMN     "sponsorship" "SponsorshipType",
ADD COLUMN     "toolsOwned" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "tshirtSize" "TshirtSize",
ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- CreateTable
CREATE TABLE "ShortCourseBatch" (
    "id" TEXT NOT NULL,
    "shortCourseId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ShortCourseBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShortCourseDocument" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "kind" "ShortCourseDocKind" NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShortCourseDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShortCourseBatch_shortCourseId_label_key" ON "ShortCourseBatch"("shortCourseId", "label");

-- CreateIndex
CREATE INDEX "ShortCourseDocument_registrationId_idx" ON "ShortCourseDocument"("registrationId");

-- CreateIndex
CREATE UNIQUE INDEX "ShortCourseRegistration_refNo_key" ON "ShortCourseRegistration"("refNo");

-- AddForeignKey
ALTER TABLE "ShortCourseBatch" ADD CONSTRAINT "ShortCourseBatch_shortCourseId_fkey" FOREIGN KEY ("shortCourseId") REFERENCES "ShortCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShortCourseRegistration" ADD CONSTRAINT "ShortCourseRegistration_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ShortCourseBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShortCourseDocument" ADD CONSTRAINT "ShortCourseDocument_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "ShortCourseRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
