import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const adapter = new PrismaBetterSqlite3({ url: 'file:./storage/database.sqlite' });
const prisma = new PrismaClient({ adapter });

async function cleanup() {
    // Find all rows that are likely false LID strays
    const strays = await prisma.user.findMany({
        where: {
            balance: 88876n,
            gamesPlayed: 0,
            pushName: null,
            lid: null
        }
    });

    for (const stray of strays) {
        console.log(`Deleting false stray row: ${stray.id}`);
        await prisma.user.delete({ where: { id: stray.id } });
    }
    console.log(`Deleted ${strays.length} false stray rows.`);
}

cleanup().finally(() => prisma.$disconnect());
