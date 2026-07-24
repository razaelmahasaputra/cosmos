-- CreateTable
CREATE TABLE "WhatsAppAuth" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "WhitelistedGroup" (
    "jid" TEXT NOT NULL PRIMARY KEY
);

-- CreateTable
CREATE TABLE "AppConfig" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "ActiveSession" (
    "feature" TEXT NOT NULL,
    "jid" TEXT NOT NULL,
    "metadata" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("feature", "jid")
);
