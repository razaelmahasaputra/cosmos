import { prisma } from './src/db.js';
async function main() {
    const users = await prisma.user.findMany({
        where: { id: { startsWith: '29709' } }
    });
    console.log(users);
}
main().catch(console.error);
