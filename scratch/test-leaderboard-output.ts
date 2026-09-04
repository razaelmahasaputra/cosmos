import { prisma } from '../src/db.js';

async function main() {
    const allUsers = await prisma.user.findMany({
        orderBy: { balance: 'desc' },
        take: 100
    });

    const seenNames = new Set<string>();
    const topUsers = [];

    for (const user of allUsers) {
        let defaultName = user.id.split('@')[0];
        if (user.id.includes('@lid')) {
            defaultName = 'Unknown Player';
        } else {
            defaultName = `+${defaultName}`;
        }
        const name = user.pushName || user.username || defaultName;
        if (!seenNames.has(name)) {
            seenNames.add(name);
            topUsers.push({ ...user, displayName: name });
        }
    }

    const finalTop = topUsers.slice(0, 10);
    console.log('Leaderboard output:');
    finalTop.forEach((user: any, index: number) => {
        console.log(`${index + 1}. ${user.displayName} - ${user.balance} coins`);
    });

    await prisma.$disconnect();
}
main().catch(console.error);
