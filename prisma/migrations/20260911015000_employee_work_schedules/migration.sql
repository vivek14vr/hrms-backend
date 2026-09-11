CREATE TABLE "WorkSchedule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "workWeek" TEXT NOT NULL,
    "shiftStart" TEXT NOT NULL,
    "shiftEnd" TEXT NOT NULL,
    "graceMinutes" INTEGER NOT NULL,
    "overtimeAfterMinutes" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkSchedule_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Employee" ADD COLUMN "scheduleId" TEXT;
CREATE INDEX "Employee_scheduleId_idx" ON "Employee"("scheduleId");
CREATE INDEX "WorkSchedule_active_name_idx" ON "WorkSchedule"("active", "name");

ALTER TABLE "Employee" ADD CONSTRAINT "Employee_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "WorkSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
