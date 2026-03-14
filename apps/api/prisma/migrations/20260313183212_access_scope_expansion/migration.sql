-- CreateEnum
CREATE TYPE "PersonType" AS ENUM ('EMPLOYEE', 'CONTRACTOR', 'VISITOR', 'SUPERVISOR', 'SERVICE_PROVIDER', 'OTHER');

-- CreateEnum
CREATE TYPE "EntryOrigin" AS ENUM ('QR_CODE', 'PANEL', 'MANUAL_ADJUSTMENT', 'AUTO_CLOSED');

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "email" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "personType" "PersonType" NOT NULL DEFAULT 'EMPLOYEE';

-- AlterTable
ALTER TABLE "Plant" ADD COLUMN     "autoCloseLimitHours" INTEGER NOT NULL DEFAULT 12,
ADD COLUMN     "lateAlertMinutes" INTEGER NOT NULL DEFAULT 540,
ADD COLUMN     "requireSelfie" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requireWifiMatch" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "TimeEntry" ADD COLUMN     "origin" "EntryOrigin" NOT NULL DEFAULT 'QR_CODE',
ADD COLUMN     "validationMode" TEXT,
ADD COLUMN     "validationNotes" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "modulePermissions" JSONB;
