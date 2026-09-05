import { ToolModule, ToolContext } from './types.js';
import { prisma } from '../db.js';
import { formatRupiah } from '../utils/currency.js';
import { getSenderJid } from '../utils/casino.js';

const inventoryTool: ToolModule = {
    definition: {
        name: 'inventory',
        aliases: ['myitems', 'bag', 'inv'],
        description: 'View your currently owned items, equipment, and properties.',
        category: 'Economy'
    },
    execute: async (_args: Record<string, any>, ctx: ToolContext) => {
        const { msg, sock, jid } = ctx;
        const userJid = getSenderJid(msg, sock);
        if (!userJid) return;

        const user = await prisma.user.findFirst({
            where: {
                OR: [{ id: userJid }, { lid: userJid }]
            }
        });

        const actualUserId = user ? user.id : userJid;

        const inventory = await prisma.userInventory.findMany({
            where: {
                userId: actualUserId,
                ownershipStatus: 'Owned'
            },
            include: {
                item: true,
                property: true
            },
            orderBy: [{ purchaseDate: 'asc' }, { id: 'asc' }]
        });

        if (inventory.length === 0) {
            await sock.sendMessage(
                jid,
                { text: 'Your inventory is currently empty. Visit the shop using `.shop` to browse items!' },
                { quoted: msg }
            );
            return;
        }

        // Separate items and properties for organized display
        const shopItems = inventory.filter((inv) => inv.itemId !== null || inv.item !== null);
        const properties = inventory.filter((inv) => inv.propertyId !== null || inv.property !== null);
        // Any legacy items that might not have item/property relations
        const legacyItems = inventory.filter(
            (inv) => inv.itemId === null && inv.item === null && inv.propertyId === null && inv.property === null
        );

        let text = `*📦 Cosmos Inventory*\n\n`;

        if (shopItems.length > 0) {
            text += `*Items & Equipment:*\n`;
            shopItems.forEach((inv, index) => {
                const itemName = inv.item?.name || inv.name || 'Unknown Item';
                const shortId = inv.item?.shortId ? ` (\`${inv.item.shortId}\`)` : '';
                const type = inv.item?.type || inv.typeCategory || 'Item';
                const typeFormatted = type.charAt(0).toUpperCase() + type.slice(1);
                text += `${index + 1}. *${itemName}*${shortId}\n`;
                text += `   Quantity: ${inv.quantity}\n`;
                text += `   Type: ${typeFormatted}\n\n`;
            });
        }

        if (properties.length > 0) {
            text += `*Owned Properties:*\n`;
            properties.forEach((inv, index) => {
                const propName = inv.property?.name || inv.name || 'Unknown Property';
                const originalPrice = inv.originalPrice ? formatRupiah(inv.originalPrice) : 'N/A';
                text += `${index + 1}. *${propName}*\n`;
                text += `   Original Value: ${originalPrice}\n`;
                text += `   Acquired: ${inv.purchaseDate.toLocaleDateString()}\n\n`;
            });
        }

        if (legacyItems.length > 0) {
            text += `*Other Assets:*\n`;
            legacyItems.forEach((inv, index) => {
                const name = inv.name || 'Asset';
                text += `${index + 1}. *${name}* (x${inv.quantity})\n\n`;
            });
        }

        text += `_Use \`.shop\` to buy more items or \`.sell <property_name>\` to liquidate properties._`;

        await sock.sendMessage(jid, { text }, { quoted: msg });
    }
};

export default inventoryTool;
