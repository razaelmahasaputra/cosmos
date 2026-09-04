import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import dotenv from 'dotenv';

dotenv.config();

const dbPath = process.env.DATABASE_URL?.replace('file:', '') || './storage/database.sqlite';
const adapter = new PrismaBetterSqlite3({ url: dbPath });
const prisma = new PrismaClient({ adapter });

const targetNumber = '6282225907841';
const newBalance = 30_000_000n; // Rp30.000.000

async function main() {
    const users = await prisma.user.findMany({
        where: { id: { contains: targetNumber } },
        select: { id: true, pushName: true, balance: true }
    });

    if (users.length === 0) {
        console.log(`No user found with number: ${targetNumber}`);
        return;
    }

    console.log('Found users:');
    for (const u of users) {
        console.log(`  ID: ${u.id} | Name: ${u.pushName ?? 'N/A'} | Balance: Rp${u.balance.toLocaleString('id-ID')}`);
    }

    const result = await prisma.user.updateMany({
        where: { id: { contains: targetNumber } },
        data: { balance: newBalance }
    });

    console.log(`\nUpdated ${result.count} user(s) — new balance: Rp${newBalance.toLocaleString('id-ID')}`);

    const updated = await prisma.user.findMany({
        where: { id: { contains: targetNumber } },
        select: { id: true, pushName: true, balance: true }
    });
    for (const u of updated) {
        console.log(`  ✅ ${u.id} (${u.pushName ?? 'N/A'}): Rp${u.balance.toLocaleString('id-ID')}`);
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
