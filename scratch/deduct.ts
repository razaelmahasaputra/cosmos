import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const adapter = new PrismaBetterSqlite3({ url: 'file:./storage/database.sqlite' });
const prisma = new PrismaClient({ adapter });

async function deduct() {
    const xiklah = await prisma.user.findUnique({ where: { id: '62895326563307' } });
    if (xiklah && xiklah.balance > 8295000000n) {
        console.log('Deducting 88876 from Xiklah');
        await prisma.user.update({
            where: { id: xiklah.id },
            data: { balance: { decrement: 88876 } }
        });
    }
}
deduct().finally(() => prisma.$disconnect());
