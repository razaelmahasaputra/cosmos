import { prisma } from './db.js';

export const INITIAL_ITEMS = [
    {
        name: 'Gorengan',
        shortId: 'gorengan',
        description: 'Authentic Indonesian fried snacks. Restores 1.5 health.',
        type: 'consumable',
        price: BigInt(2000),
        isAvailable: true
    },
    {
        name: 'Yakult',
        shortId: 'yakult',
        description: 'A probiotic dairy drink. Restores 2.5 health.',
        type: 'consumable',
        price: BigInt(2500),
        isAvailable: true
    },
    {
        name: 'Tolak Angin',
        shortId: 'tolakangin',
        description: 'Herbal remedy to cure debuffs and restore 5 health.',
        type: 'consumable',
        price: BigInt(3500),
        isAvailable: true
    },
    {
        name: 'Indomie Goreng',
        shortId: 'indomie',
        description: 'The ultimate comfort food. Restores 10 health.',
        type: 'consumable',
        price: BigInt(3500),
        isAvailable: true
    },
    {
        name: 'Bambu Runcing',
        shortId: 'bambu',
        description: 'A traditional bamboo spear for combat.',
        type: 'equipment',
        price: BigInt(15000),
        isAvailable: true
    },
    {
        name: 'Sandal Swallow',
        shortId: 'swallow',
        description: 'Legendary rubber sandals. Good for defense.',
        type: 'equipment',
        price: BigInt(12000),
        isAvailable: true
    },
    {
        name: 'Sarung BHS',
        shortId: 'sarung',
        description: 'A high-quality woven sarong, perfect for flexing.',
        type: 'collectible',
        price: BigInt(500000),
        isAvailable: true
    }
];

export async function seedItems() {
    console.log('Seeding initial shop items...');

    for (const item of INITIAL_ITEMS) {
        await prisma.item.upsert({
            where: { shortId: item.shortId },
            update: {
                name: item.name,
                description: item.description,
                type: item.type,
                price: item.price,
                isAvailable: item.isAvailable
            },
            create: {
                name: item.name,
                shortId: item.shortId,
                description: item.description,
                type: item.type,
                price: item.price,
                isAvailable: item.isAvailable
            }
        });
        console.log(`Upserted item: ${item.name} (${item.shortId})`);
    }

    console.log('Shop items seeded successfully.');
}

// Allow running directly as a script
if (process.argv[1] && process.argv[1].endsWith('seed_item.ts')) {
    seedItems()
        .catch((err) => {
            console.error('Error seeding items:', err);
            process.exit(1);
        })
        .finally(async () => {
            await prisma.$disconnect();
        });
}
