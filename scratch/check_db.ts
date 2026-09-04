import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const adapter = new PrismaBetterSqlite3({ url: 'file:./storage/database.sqlite' });
const prisma = new PrismaClient({ adapter });

async function main() {
    const users = await prisma.user.findMany();
    console.log('Total users:', users.length);
    console.dir(
        users.filter(
            (u) =>
                u.pushName?.includes('Razael') ||
                u.id.includes('1203') ||
                u.id.includes('8573119') ||
                u.pushName?.includes('Unknown') ||
                u.pushName?.includes('Cila')
        ),
        { depth: null }
    );
}
main().finally(() => prisma.$disconnect());
