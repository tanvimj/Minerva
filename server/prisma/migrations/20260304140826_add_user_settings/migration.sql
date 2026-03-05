-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accent" TEXT NOT NULL DEFAULT '#a78bfa',
ADD COLUMN     "bio" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'en',
ADD COLUMN     "theme" TEXT NOT NULL DEFAULT 'dark',
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata';
