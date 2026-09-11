CREATE TABLE "WorkspaceSettings" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "workWeek" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkspaceSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "WorkspaceSettings" ("id", "name", "timezone", "currency", "workWeek", "updatedAt")
VALUES ('workspace-settings', 'PeopleOS Demo', 'Asia/Kolkata', 'INR', 'Monday – Friday', CURRENT_TIMESTAMP);
