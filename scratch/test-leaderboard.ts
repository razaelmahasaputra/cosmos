import { prisma } from '../src/db.js';

async function main() {
    const users = await prisma.user.findMany({
        orderBy: { balance: 'desc' },
        take: 10
    });
    console.log('Database Top Users:');
    users.forEach((u, i) => {
        console.log(`${i + 1}. ${u.id} (${u.pushName || 'no-name'}): ${u.balance} coins`);
    });
    await prisma.$disconnect();
}
main().catch((e) => {
    console.error(e);
    process.exit(1);
});
