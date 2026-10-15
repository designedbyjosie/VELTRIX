-- AlterTable
ALTER TABLE "UserPreference" ADD COLUMN     "focusAreas" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "hiddenAreas" TEXT[] DEFAULT ARRAY[]::TEXT[];
