import { ToolModule, ToolContext } from './types.js';
import { prisma } from '../db.js';
import { formatRupiah } from '../utils/currency.js';
import { getSenderJid } from '../utils/casino.js';

const propertyInventoryTool: ToolModule = {
    definition: {
        name: 'inventory',
        aliases: ['properties', 'myitems'],
        description: 'View your currently owned properties and items.',
        category: 'Economy'
    },
    execute: async (args: Record<string, any>, ctx: ToolContext) => {
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
            where: { userId: actualUserId }
        });

        if (inventory.length === 0) {
            await sock.sendMessage(jid, { text: 'Your inventory is currently empty.' }, { quoted: msg });
            return;
        }

        let text = `*📦 Your Inventory*\n\n`;
        inventory.forEach((item, index) => {
            text += `${index + 1}. *${item.name}*\n`;
            text += `   Status: ${item.ownershipStatus}\n`;
            text += `   Original Price: ${formatRupiah(Number(item.originalPrice))}\n`;
            text += `   Purchased: ${item.purchaseDate.toLocaleDateString()}\n\n`;
        });

        text += `_Use the "sell" or "pawn" command to liquidate your assets._`;

        await sock.sendMessage(jid, { text }, { quoted: msg });
    }
};

export default propertyInventoryTool;
