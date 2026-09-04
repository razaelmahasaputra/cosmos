import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const adapter = new PrismaBetterSqlite3({ url: 'file:./storage/database.sqlite' });
const prisma = new PrismaClient({ adapter });

async function fix() {
    const strayLid = await prisma.user.findUnique({ where: { id: '8675833995284' } });
    if (strayLid) {
        // This is sat parker's LID row that was created by .balance.
        // We will merge it manually.
        await prisma.user.update({
            where: { id: '6285311862926' }, // sat parker JID
            data: { lid: '8675833995284' } // DON'T ADD 88876 balance, it was false!
        });

        await prisma.user.delete({ where: { id: '8675833995284' } });
        console.log("Fixed sat parker's LID and deleted false row.");
    }
}
fix().finally(() => prisma.$disconnect());
