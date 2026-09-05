import { ToolModule, ToolContext } from './types.js';
import { prisma } from '../db.js';
import { formatRupiah } from '../utils/currency.js';
import { getShopItems } from '../services/shopService.js';

const shopTool: ToolModule = {
    definition: {
        name: 'shop',
        aliases: ['store', 'itemshop'],
        description: 'Browse the Cosmos Shop categories and available items.',
        category: 'Economy',
        parameters: {
            type: 'object',
            properties: {
                category: {
                    type: 'string',
                    description: 'The category to browse (e.g. items, properties, consumable, equipment, collectible).'
                }
            },
            required: []
        }
    },
    execute: async (args: Record<string, any>, ctx: ToolContext) => {
        const { msg, sock, jid } = ctx;

        // Parse category from args or raw command text if provided
        let rawCategory = args.category;
        if (!rawCategory) {
            const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
            const match = text.match(/^[./!#](?:shop|store|itemshop)\s+(.+)$/i);
            if (match) {
                rawCategory = match[1].trim();
            }
        }

        const category = typeof rawCategory === 'string' ? rawCategory.trim().toLowerCase() : '';

        // If no category specified, display the main categories menu
        if (!category) {
            // Find distinct item categories currently available
            const distinctItemTypes = await prisma.item.findMany({
                where: { isAvailable: true },
                select: { type: true },
                distinct: ['type']
            });

            const categoryList = ['Properties'];
            for (const t of distinctItemTypes) {
                // Capitalize first letter
                const formatted = t.type.charAt(0).toUpperCase() + t.type.slice(1);
                if (!categoryList.includes(formatted)) {
                    categoryList.push(formatted);
                }
            }

            let text = `*🏬 Cosmos Shop - Categories*\n\n`;
            text += `Select a category to browse:\n`;
            categoryList.forEach((cat) => {
                text += `• \`.shop ${cat.toLowerCase()}\`\n`;
            });
            text += `• \`.shop items\` _(View all general items)_\n\n`;
            text += `*Usage:*\n`;
            text += `• Type \`.shop <category>\` to view items in a category.\n`;
            text += `• Type \`.buy <short_id> [quantity]\` to purchase an item.`;

            await sock.sendMessage(jid, { text }, { quoted: msg });
            return;
        }

        // Check if user requested "properties" or "property"
        if (category === 'properties' || category === 'property') {
            const properties = await prisma.propertyCatalog.findMany({
                orderBy: [{ basePrice: 'asc' }, { name: 'asc' }]
            });

            if (properties.length === 0) {
                await sock.sendMessage(jid, { text: 'The property catalog is currently empty.' }, { quoted: msg });
                return;
            }

            let text = `*🏬 Cosmos Property Catalog*\n\n`;
            properties.forEach((p, index) => {
                text += `${index + 1}. *${p.name}*\n`;
                text += `   Type: ${p.typeCategory}\n`;
                text += `   Price: ${formatRupiah(Number(p.basePrice))}\n`;
                text += `   Depreciation: ${p.baseDepreciationRate * 100}%\n\n`;
            });

            text += `_Use \`.buy <property_name>\` to purchase a property._`;
            await sock.sendMessage(jid, { text }, { quoted: msg });
            return;
        }

        // Otherwise, fetch shop items (either all items or filtered by category)
        const filterCategory = category === 'items' || category === 'all' ? undefined : category;
        const items = await getShopItems(filterCategory);

        if (items.length === 0) {
            await sock.sendMessage(
                jid,
                {
                    text: `No items found in category "${rawCategory}". Use \`.shop\` to see available categories.`
                },
                { quoted: msg }
            );
            return;
        }

        const headerTitle = filterCategory
            ? `${filterCategory.charAt(0).toUpperCase() + filterCategory.slice(1)} Items`
            : 'All Items';

        let text = `*🛍️ Cosmos Shop - ${headerTitle}*\n\n`;
        items.forEach((item, index) => {
            text += `${index + 1}. *${item.name}* (\`${item.shortId}\`)\n`;
            text += `   Type: ${item.type.charAt(0).toUpperCase() + item.type.slice(1)}\n`;
            text += `   Price: ${formatRupiah(item.price)}\n`;
            text += `   Desc: ${item.description}\n\n`;
        });

        text += `_To purchase an item, use: \`.buy <short_id> [quantity]\`_`;

        await sock.sendMessage(jid, { text }, { quoted: msg });
    }
};

export default shopTool;
