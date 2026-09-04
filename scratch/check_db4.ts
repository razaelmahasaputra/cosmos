import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const adapter = new PrismaBetterSqlite3({ url: 'file:./storage/database.sqlite' });
const prisma = new PrismaClient({ adapter });

async function check() {
    const users = await prisma.user.findMany();
    console.log(
        'Users:',
        users.map((u) => ({ id: u.id, lid: u.lid, pushName: u.pushName, balance: u.balance.toString() }))
    );
}
check().finally(() => prisma.$disconnect());
