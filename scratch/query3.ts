import { prisma } from '../src/db.js';

async function main() {
    const users = await prisma.user.findMany({
        where: {
            balance: 88876
        }
    });
    console.log(users.map((u) => ({ ...u, balance: u.balance.toString() })));
}
main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
