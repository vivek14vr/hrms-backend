CREATE TABLE "CompensationHistory" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "baseSalary" DECIMAL(12,2) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CompensationHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompensationHistory_employeeId_effectiveFrom_key" ON "CompensationHistory"("employeeId", "effectiveFrom");
CREATE INDEX "CompensationHistory_employeeId_effectiveFrom_idx" ON "CompensationHistory"("employeeId", "effectiveFrom");

ALTER TABLE "CompensationHistory" ADD CONSTRAINT "CompensationHistory_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "CompensationHistory" ("id", "employeeId", "effectiveFrom", "baseSalary", "reason")
SELECT md5('initial-compensation:' || "id"), "id", "joiningDate", "baseSalary", 'Initial compensation'
FROM "Employee";
