-- AlterTable
ALTER TABLE "ShortCourseRegistration" ADD COLUMN     "decidedAt" TIMESTAMP(3),
ADD COLUMN     "decisionNote" TEXT,
ADD COLUMN     "submittedAt" TIMESTAMP(3);
