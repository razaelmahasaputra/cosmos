import { prisma } from '../src/db.js';

async function main() {
    const users = await prisma.user.findMany({
        where: { OR: [{ pushName: 'Xiklah' }, { username: 'Xiklah' }] }
    });
    console.log(users.map((u) => ({ id: u.id, balance: u.balance })));
    await prisma.$disconnect();
}
main().catch(console.error);
