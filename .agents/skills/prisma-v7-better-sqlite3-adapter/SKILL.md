---
name: prisma-v7-better-sqlite3-adapter
description: Panduan untuk menginisialisasi PrismaClient v7 menggunakan driver adapter @prisma/adapter-better-sqlite3
---

# Prisma v7: @prisma/adapter-better-sqlite3

## Deskripsi Error

Saat melakukan upgrade Prisma ke v7 dengan adapter `better-sqlite3`, jika adapter diinstansiasi dengan melempar instance `Database` dari `better-sqlite3`, akan muncul error TypeScript atau runtime karena adapter v7 telah berubah dan memerlukan argumen berupa objek `{ url: string }`.

**Error yang terjadi:**

```
Argument of type 'Database' is not assignable to parameter of type 'BetterSQLite3InputParams'.
Property 'url' is missing in type 'Database' but required in type '{ url: ":memory:" | (string & {}); }'
```

## Solusi / Implementasi Benar

Di Prisma v7, inisialisasi `PrismaBetterSqlite3` harus dilakukan dengan memberikan parameter objek opsi yang mengandung properti `url` berupa path database, **bukan** sebuah instance dari driver `better-sqlite3` secara langsung.

Contoh implementasi yang benar:

```typescript
import { PrismaClient } from './generated/prisma/client.js';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

// 1. Definisikan path dari database SQLite
let dbPath = process.env.DATABASE_URL?.replace('file:', '') || './storage/database.sqlite';

// 2. Instansiasi adapter dengan objek `{ url: dbPath }`
const adapter = new PrismaBetterSqlite3({ url: dbPath });

// 3. Masukkan adapter ke PrismaClient
export const prisma = new PrismaClient({ adapter });
```

**Penting:**

- Tidak perlu mengimpor `Database` dari `better-sqlite3` di file ini.
- Jangan melakukan `const sqlite = new Database(...)`.
- Langsung teruskan `{ url }` ke dalam `PrismaBetterSqlite3`.
