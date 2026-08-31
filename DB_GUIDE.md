# DB_GUIDE.md - Database Guidelines for AI Agents

This document contains essential instructions and rules for AI Agents when interacting with or modifying the database in the WAF (WhatsApp Bot Framework) project.

## 1. Stack & Architecture

- **ORM:** Prisma v7
- **Database:** SQLite
- **Driver Adapter:** `@prisma/adapter-better-sqlite3`
- **Location:** The SQLite database is stored locally at `storage/database.sqlite`.

## 2. Prisma Setup & Configuration

- **Prisma Configuration:** The project uses Prisma v7, which relies on `prisma.config.ts` in the root directory.
- **Environment Variables:** For Prisma CLI commands (like `db push`) to work, ensure the `.env` file exists and contains:
    ```env
    DATABASE_URL="file:./storage/database.sqlite"
    ```

## 3. Modifying the Schema

When adding new features or tables, always update `prisma/schema.prisma`.

**Rules for Schema Changes:**

1. **Backward Compatibility:** Always try to make additive changes (adding new columns/models) with `@default()` values to avoid breaking existing data and sessions.
2. **Pushing Changes:** After modifying the schema, apply the changes using:
    ```bash
    pnpm exec prisma db push
    ```
    _Note: `db push` is preferred over `migrate dev` for prototyping and adding additive columns to avoid unnecessary migration histories._

## 4. Generating the Client

- The Prisma Client output directory is customized in `schema.prisma` to output to `../src/generated/prisma`.
- Whenever you modify the schema and run `db push`, you **must** ensure the client is regenerated:
    ```bash
    pnpm exec prisma generate
    ```

## 5. Importing Prisma Client in Code

Because the client is generated into a custom directory, **DO NOT** import `PrismaClient` from `@prisma/client`.
Instead, import it from the generated directory using the `.js` extension (since this is an ESM project).

**Correct Example (depending on your file's relative path):**

```typescript
import { PrismaClient } from '../generated/prisma/client.js';
// OR import the pre-instantiated singleton from db.ts:
import { prisma } from '../db.js';
```

## 6. Query Execution & Best Practices

- **ESM Compatibility:** Ensure all internal imports inside TypeScript files end with `.js`.
- **Transactions:** Use Prisma `$transaction` for operations that must be atomic, such as economy transfers (preventing "Anti-Miss" or money duplication bugs).
- **In-Memory Locks:** For high-concurrency scenarios (e.g. gambling/betting commands), utilize in-memory Mutex locks (by User JID) in addition to Prisma to prevent race conditions that could lead to negative balances.
- **Data Persistence:** Always use the database for state that must survive bot restarts (e.g., persistent cooldowns `lastGambleAt`, auto-delete queues, economy balances). Avoid relying entirely on volatile `setTimeout` or in-memory caches unless specifically designated for short-term caching (like a 5-minute leaderboard cache).
