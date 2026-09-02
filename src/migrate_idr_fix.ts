import { prisma } from './db.js';

async function main() {
    console.log('Starting migration to fix IDR...');

    // Update users
    const users = await prisma.user.findMany();
    let userCount = 0;
    for (const user of users) {
        const currentBalance = Number(user.balance);
        // currentBalance was multiplied by 18000. So we divide by 18000 and multiply by 17775.15
        const newBalance = Math.floor((currentBalance / 18000) * 17775.15);
        await prisma.user.update({
            where: { id: user.id },
            data: { balance: BigInt(newBalance) }
        });
        userCount++;
    }
    console.log(`Migrated ${userCount} users.`);

    // Update house vault
    const vault = await prisma.houseVault.findUnique({ where: { id: 1 } });
    if (vault) {
        await prisma.houseVault.update({
            where: { id: 1 },
            data: {
                income: BigInt(Math.floor((Number(vault.income) / 18000) * 17775.15)),
                payout: BigInt(Math.floor((Number(vault.payout) / 18000) * 17775.15)),
                netProfit: BigInt(Math.floor((Number(vault.netProfit) / 18000) * 17775.15))
            }
        });
        console.log('Migrated house vault.');
    }

    console.log('Migration complete!');
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
