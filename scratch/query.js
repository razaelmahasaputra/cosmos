import { PrismaClient } from './src/generated/prisma/index.js';
const prisma = new PrismaClient();
async function main() {
    const users = await prisma.user.findMany();
    console.log(users);
}
main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
