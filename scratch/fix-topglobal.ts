// Test logic for grouping
import { prisma } from '../src/db.js';

async function main() {
    const allUsers = await prisma.user.findMany({
        orderBy: { balance: 'desc' }
    });

    const userMap = new Map();

    for (const user of allUsers) {
        let defaultName = user.id.split('@')[0];
        if (user.id.includes('@lid')) {
            defaultName = 'Unknown Player';
        } else {
            defaultName = `+${defaultName}`;
        }
        const name = user.pushName || user.username || defaultName;

        if (!userMap.has(name)) {
            userMap.set(name, { ...user, displayName: name });
        } else {
            const existing = userMap.get(name);
            existing.balance += user.balance;
            existing.rouletteWins += user.rouletteWins;
            existing.rouletteRounds += user.rouletteRounds;
        }
    }

    const mergedUsers = Array.from(userMap.values());
    mergedUsers.sort((a, b) => b.balance - a.balance);
    const topGlobal = mergedUsers.slice(0, 10);
    console.log('Fixed Leaderboard:');
    topGlobal.forEach((u, i) => console.log(`${i + 1}. ${u.displayName} - ${u.balance} coins`));

    await prisma.$disconnect();
}
main().catch(console.error);
