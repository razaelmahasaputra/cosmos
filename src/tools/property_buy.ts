import { ToolModule, ToolContext } from './types.js';
import { prisma } from '../db.js';
import { formatRupiah } from '../utils/currency.js';
import { getSenderJid } from '../utils/casino.js';
import { purchaseItem } from '../services/shopService.js';

const buyTool: ToolModule = {
    definition: {
        name: 'buy',
        aliases: ['purchase'],
        description: 'Purchase an item or property from the shop using your balance.',
        category: 'Economy',
        parameters: {
            type: 'object',
            properties: {
                item_name: {
                    type: 'string',
                    description: 'The shortId or name of the item/property you want to buy.'
                },
                quantity: {
                    type: 'integer',
                    description: 'The quantity to purchase (defaults to 1).'
                }
            },
            required: ['item_name']
        }
    },
    execute: async (args: Record<string, any>, ctx: ToolContext) => {
        const { msg, sock, jid } = ctx;
        const userJid = getSenderJid(msg, sock);
        if (!userJid) return;

        // Ensure user exists in database
        let user = await prisma.user.findFirst({
            where: {
                OR: [{ id: userJid }, { lid: userJid }]
            }
        });
        if (!user) {
            user = await prisma.user.create({ data: { id: userJid, balance: BigInt(10000) } });
        }

        let inputTarget = args.item_name;
        let inputQuantity = args.quantity ? parseInt(args.quantity, 10) : 1;

        if (!inputTarget) {
            // Attempt to parse from message text (e.g. .buy <short_id> [quantity])
            const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
            const match = text.match(/^[./!#](?:buy|purchase)\s+(.+)$/i);
            if (match) {
                const parts = match[1].trim().split(/\s+/);
                // Check if last part is a quantity number
                if (parts.length > 1 && /^\d+$/.test(parts[parts.length - 1])) {
                    inputQuantity = parseInt(parts.pop()!, 10);
                    inputTarget = parts.join(' ').trim();
                } else {
                    inputTarget = parts.join(' ').trim();
                }
            } else {
                await sock.sendMessage(
                    jid,
                    {
                        text: 'Please specify the item or property you want to buy. Format: `.buy <short_id> [quantity]`'
                    },
                    { quoted: msg }
                );
                return;
            }
        }

        if (isNaN(inputQuantity) || inputQuantity <= 0) {
            inputQuantity = 1;
        }

        const normalizedTarget = String(inputTarget).trim();

        // 1. First check if target matches an Item (by shortId or name)
        const matchedItem = await prisma.item.findFirst({
            where: {
                OR: [
                    { shortId: normalizedTarget.toLowerCase() },
                    { name: { equals: normalizedTarget } },
                    { id: normalizedTarget }
                ]
            }
        });

        if (matchedItem) {
            const purchaseResult = await purchaseItem(user.id, matchedItem.shortId, inputQuantity);

            if (!purchaseResult.success) {
                if (purchaseResult.message.includes('Insufficient balance')) {
                    const totalCost = matchedItem.price * BigInt(inputQuantity);
                    await sock.sendMessage(
                        jid,
                        {
                            text: `You do not have enough funds to purchase ${inputQuantity}x *${matchedItem.name}*. Total cost: ${formatRupiah(totalCost)}, but your current balance is ${formatRupiah(user.balance)}.`
                        },
                        { quoted: msg }
                    );
                    return;
                }
                await sock.sendMessage(jid, { text: purchaseResult.message }, { quoted: msg });
                return;
            }

            const totalFormatted = formatRupiah(purchaseResult.totalCost || 0);
            const remainingFormatted = formatRupiah(purchaseResult.remainingBalance || 0);
            await sock.sendMessage(
                jid,
                {
                    text: `🎉 Purchase successful! You bought *${purchaseResult.quantity}x ${matchedItem.name}* for *${totalFormatted}*.\nRemaining balance: *${remainingFormatted}*.`
                },
                { quoted: msg }
            );
            return;
        }

        // 2. If not found as Item, check if target matches a Property in PropertyCatalog
        const allProperties = await prisma.propertyCatalog.findMany({
            orderBy: [{ basePrice: 'asc' }, { name: 'asc' }]
        });

        let targetProp = null;
        const propertyIndex = parseInt(normalizedTarget, 10);
        if (
            /^\d+$/.test(normalizedTarget) &&
            !isNaN(propertyIndex) &&
            propertyIndex > 0 &&
            propertyIndex <= allProperties.length
        ) {
            targetProp = allProperties[propertyIndex - 1];
        }

        if (!targetProp) {
            targetProp = allProperties.find((p) => p.name.toLowerCase() === normalizedTarget.toLowerCase()) || null;
        }

        if (!targetProp) {
            targetProp =
                allProperties.find((p) => p.name.toLowerCase().includes(normalizedTarget.toLowerCase())) || null;
        }

        if (!targetProp) {
            await sock.sendMessage(
                jid,
                {
                    text: `Item or property "${normalizedTarget}" was not found. Use \`.shop\` to view available items.`
                },
                { quoted: msg }
            );
            return;
        }

        // Handle property purchase (properties are unique, quantity is 1)
        if (user.balance < targetProp.basePrice) {
            await sock.sendMessage(
                jid,
                {
                    text: `You do not have enough funds to purchase ${targetProp.name}. The property costs ${formatRupiah(Number(targetProp.basePrice))}, but your current balance is only ${formatRupiah(Number(user.balance))}.`
                },
                { quoted: msg }
            );
            return;
        }

        await prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { id: user!.id },
                data: { balance: { decrement: targetProp!.basePrice } }
            });

            await tx.userInventory.create({
                data: {
                    userId: user!.id,
                    propertyId: targetProp!.id,
                    name: targetProp!.name,
                    typeCategory: targetProp!.typeCategory,
                    originalPrice: targetProp!.basePrice,
                    ownershipStatus: 'Owned'
                }
            });

            await tx.propertyTransaction.create({
                data: {
                    userId: user!.id,
                    propertyId: targetProp!.id,
                    transactionType: 'Buy',
                    amount: targetProp!.basePrice
                }
            });
        });

        await sock.sendMessage(
            jid,
            {
                text: `🎉 Congratulations! You have successfully purchased *${targetProp.name}* for ${formatRupiah(Number(targetProp.basePrice))}.`
            },
            { quoted: msg }
        );
    }
};

export default buyTool;
