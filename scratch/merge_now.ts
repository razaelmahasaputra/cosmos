import { autoMergeAccounts } from '../src/utils/casino.js';
import { prisma } from '../src/db.js';

async function main() {
    await autoMergeAccounts('122123905433603', '6283196097935');
    console.log('Merged manually.');
}
main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
