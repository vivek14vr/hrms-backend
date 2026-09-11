CREATE TABLE "EmployeeCodeSequence" (
    "id" TEXT NOT NULL,
    "nextValue" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmployeeCodeSequence_pkey" PRIMARY KEY ("id")
);

INSERT INTO "EmployeeCodeSequence" ("id", "nextValue")
SELECT 'employee-code',
       COALESCE(MAX(CASE
           WHEN "employeeCode" ~ '^PO-[0-9]+$' THEN CAST(SUBSTRING("employeeCode" FROM 4) AS INTEGER)
           ELSE 0
       END), 0) + 1
FROM "Employee";
