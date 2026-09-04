import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const adapter = new PrismaBetterSqlite3({ url: 'file:./storage/database.sqlite' });
const prisma = new PrismaClient({ adapter });

async function mergeStrayLids() {
    const users = await prisma.user.findMany();
    let merged = 0;

    for (const mainUser of users) {
        if (mainUser.lid) {
            // Find if there is a stray row where id === mainUser.lid
            const stray = users.find((u) => u.id === mainUser.lid);
            if (stray) {
                console.log(`Merging stray LID ${stray.id} into main JID ${mainUser.id}`);
                await prisma.user.update({
                    where: { id: mainUser.id },
                    data: {
                        balance: { increment: stray.balance },
                        totalWins: { increment: stray.totalWins },
                        totalLosses: { increment: stray.totalLosses },
                        gamesPlayed: { increment: stray.gamesPlayed },
                        rouletteRounds: { increment: stray.rouletteRounds },
                        rouletteWins: { increment: stray.rouletteWins },
                        rouletteKills: { increment: stray.rouletteKills },
                        rouletteAfk: { increment: stray.rouletteAfk }
                    }
                });
                await prisma.user.delete({ where: { id: stray.id } });
                merged++;
            }
        }
    }
    console.log(`Merged ${merged} stray LID rows.`);
}

mergeStrayLids().finally(() => prisma.$disconnect());
