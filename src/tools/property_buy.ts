import { ToolModule, ToolContext } from './types.js';
import { prisma } from '../db.js';
import { formatRupiah } from '../utils/currency.js';
import { getSenderJid } from '../utils/casino.js';

const propertyBuyTool: ToolModule = {
    definition: {
        name: 'buy',
        aliases: ['purchase'],
        description: 'Purchase a property from the catalog.',
        category: 'Economy',
        parameters: {
            type: 'object',
            properties: {
                property_name: {
                    type: 'string',
                    description: 'The name of the property you want to buy.'
                }
            },
            required: ['property_name']
        }
    },
    execute: async (args: Record<string, any>, ctx: ToolContext) => {
        const { msg, sock, jid } = ctx;
        const userJid = getSenderJid(msg, sock);
        if (!userJid) return;

        let propertyName = args.property_name;

        // Ensure user exists
        let user = await prisma.user.findFirst({
            where: {
                OR: [{ id: userJid }, { lid: userJid }]
            }
        });
        if (!user) {
            user = await prisma.user.create({ data: { id: userJid, balance: BigInt(10000) } });
        }

        if (!propertyName) {
            // Attempt to parse from message text if not provided as structured args (e.g. text message instead of AI tool)
            const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
            const match = text.match(/^[./!#]buy\s+(.+)$/i);
            if (match) {
                propertyName = match[1].trim();
            } else {
                await sock.sendMessage(
                    jid,
                    { text: 'Please specify the name of the property you want to buy.' },
                    { quoted: msg }
                );
                return;
            }
        }

        let targetProp = await prisma.propertyCatalog.findFirst({
            where: {
                name: {
                    equals: propertyName
                }
            }
        });

        if (!targetProp) {
            // Try fetching all and doing a loose match
            const allProperties = await prisma.propertyCatalog.findMany();
            targetProp = allProperties.find((p) => p.name.toLowerCase() === propertyName.toLowerCase()) || null;
        }

        if (!targetProp) {
            await sock.sendMessage(
                jid,
                { text: `Property "${propertyName}" not found in the catalog.` },
                { quoted: msg }
            );
            return;
        }

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

        // Process transaction
        await prisma.$transaction(async (tx) => {
            // Deduct balance
            await tx.user.update({
                where: { id: user.id },
                data: { balance: { decrement: targetProp.basePrice } }
            });

            // Create inventory
            await tx.userInventory.create({
                data: {
                    userId: user.id,
                    propertyId: targetProp.id,
                    name: targetProp.name,
                    typeCategory: targetProp.typeCategory,
                    originalPrice: targetProp.basePrice,
                    ownershipStatus: 'Owned'
                }
            });

            // Create transaction history
            await tx.propertyTransaction.create({
                data: {
                    userId: user.id,
                    propertyId: targetProp.id,
                    transactionType: 'Buy',
                    amount: targetProp.basePrice
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

export default propertyBuyTool;
