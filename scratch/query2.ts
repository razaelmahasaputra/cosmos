import { prisma } from '../src/db.js';

async function main() {
    const users = await prisma.user.findMany({
        where: {
            OR: [{ id: { contains: '6283196097935' } }, { lid: { contains: '6283196097935' } }]
        }
    });
    console.log(users.map((u) => ({ ...u, balance: u.balance.toString() })));
}
main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
