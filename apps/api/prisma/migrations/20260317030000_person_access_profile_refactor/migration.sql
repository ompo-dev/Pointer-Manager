-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- Seed Person from the legacy Employee identities before relaxing legacy columns.
INSERT INTO "Person" ("id", "cpf", "fullName", "createdAt", "updatedAt")
SELECT
    "id",
    "cpf",
    "fullName",
    "createdAt",
    "updatedAt"
FROM "Employee";

-- AlterTable
ALTER TABLE "Employee"
ADD COLUMN     "personId" TEXT;

UPDATE "Employee"
SET "personId" = "id"
WHERE "personId" IS NULL;

ALTER TABLE "Employee"
ALTER COLUMN "personId" SET NOT NULL,
ALTER COLUMN "cpf" DROP NOT NULL,
ALTER COLUMN "fullName" DROP NOT NULL;

-- DropIndex
DROP INDEX IF EXISTS "Employee_cpf_key";

-- CreateIndex
CREATE UNIQUE INDEX "Person_cpf_key" ON "Person"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_organizationId_personId_key" ON "Employee"("organizationId", "personId");

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
