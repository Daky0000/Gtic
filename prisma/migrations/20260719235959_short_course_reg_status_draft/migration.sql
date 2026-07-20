-- Split out from 20260720000000_short_course_training_form: PostgreSQL will
-- not let a newly added enum value be used (e.g. as a column DEFAULT) in the
-- same transaction that adds it ("unsafe use of new value of enum type").
-- Prisma applies each migration file as one transaction, so the ADD VALUE
-- has to land — and commit — in its own migration before anything that
-- references 'DRAFT' can run.
ALTER TYPE "ShortCourseRegStatus" ADD VALUE 'DRAFT';
