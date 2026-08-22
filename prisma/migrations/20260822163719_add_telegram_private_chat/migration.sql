-- CreateTable
CREATE TABLE "TelegramPrivateChat" (
    "chatId" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT,
    "inviteLink" TEXT,
    "added_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
