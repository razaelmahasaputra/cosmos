import { prisma } from '../src/db.js';

async function main() {
    const users = await prisma.user.findMany();

    const byName = new Map();
    for (const u of users) {
        let defaultName = u.id.split('@')[0];
        if (u.id.includes('@lid')) {
            defaultName = 'Unknown Player';
        } else {
            defaultName = `+${defaultName}`;
        }
        const name = u.pushName || u.username || defaultName;

        if (!byName.has(name)) {
            byName.set(name, { name, balance: 0, entries: 0 });
        }
        const rec = byName.get(name);
        rec.balance += u.balance;
        rec.entries += 1;
    }

    const sorted = Array.from(byName.values()).sort((a, b) => b.balance - a.balance);
    console.log(sorted);
    await prisma.$disconnect();
}
main().catch(console.error);
