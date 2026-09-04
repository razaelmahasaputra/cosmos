import { autoMergeAccounts } from '../src/utils/casino.js';
import { prisma } from '../src/db.js';

async function main() {
    console.log('Starting merge...');
    await autoMergeAccounts('49890910535790', '6282225907841');
    console.log('Merge done');
}
main().finally(() => prisma.$disconnect());
