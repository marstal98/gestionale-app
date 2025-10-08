-- Create CustomerAssignment table for N:N assignments between customers and employees
CREATE TABLE IF NOT EXISTS "CustomerAssignment" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "customerId" INTEGER NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT (datetime('now')),
    CONSTRAINT "CustomerAssignment_customerId_employeeId_key" UNIQUE ("customerId", "employeeId"),
    CONSTRAINT "CustomerAssignment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CustomerAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "CustomerAssignment_employeeId_idx" ON "CustomerAssignment" ("employeeId");
CREATE INDEX IF NOT EXISTS "CustomerAssignment_customerId_idx" ON "CustomerAssignment" ("customerId");
