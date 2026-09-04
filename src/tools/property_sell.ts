import { ToolModule, ToolContext } from './types.js';
import { prisma } from '../db.js';
import { formatRupiah } from '../utils/currency.js';
import { getSenderJid } from '../utils/casino.js';
import { Groq } from 'groq-sdk';

function getGroqClient(): Groq {
    return new Groq({ apiKey: process.env.GROQ_API_KEY });
}

const propertySellTool: ToolModule = {
    definition: {
        name: 'sell',
        aliases: ['pawn', 'sellproperty'],
        description: 'Sell or pawn a property you own to the bank, with an optional AI negotiation system.',
        category: 'Economy',
        parameters: {
            type: 'object',
            properties: {
                property_name: {
                    type: 'string',
                    description: 'The name of the property to sell.'
                },
                negotiation: {
                    type: 'string',
                    description: 'Optional persuasion text to negotiate a better deal with the AI broker.'
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
        let negotiationText = args.negotiation;

        const user = await prisma.user.findFirst({
            where: {
                OR: [{ id: userJid }, { lid: userJid }]
            }
        });

        const actualUserId = user ? user.id : userJid;

        if (!propertyName) {
            const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
            const match = text.match(/^[./!#](sell|pawn)\s+([^|]+)(?:\|(.*))?$/i);
            if (match) {
                propertyName = match[2].trim();
                negotiationText = match[3] ? match[3].trim() : undefined;
            } else {
                await sock.sendMessage(
                    jid,
                    {
                        text: 'Please specify the property name to sell. Format: /sell <property_name> | <optional_negotiation>'
                    },
                    { quoted: msg }
                );
                return;
            }
        }

        let inventoryItem = await prisma.userInventory.findFirst({
            where: {
                userId: actualUserId,
                name: propertyName,
                ownershipStatus: 'Owned'
            }
        });

        if (!inventoryItem) {
            const allItems = await prisma.userInventory.findMany({
                where: {
                    userId: actualUserId,
                    ownershipStatus: 'Owned'
                }
            });
            inventoryItem = allItems.find((p) => p.name.toLowerCase() === propertyName.toLowerCase()) || null;
        }

        if (!inventoryItem) {
            await sock.sendMessage(
                jid,
                { text: `You do not own a property named "${propertyName}" or it is already pawned/sold.` },
                { quoted: msg }
            );
            return;
        }

        const propertyDef = await prisma.propertyCatalog.findUnique({
            where: { id: inventoryItem.propertyId }
        });

        if (!propertyDef) {
            await sock.sendMessage(
                jid,
                { text: `Property definition not found for ${propertyName}.` },
                { quoted: msg }
            );
            return;
        }

        // Calculate Base Offer
        const originalPrice = Number(inventoryItem.originalPrice);
        const baseOffer = Math.floor(originalPrice * (1 - propertyDef.baseDepreciationRate));
        const hardCap = Math.floor(originalPrice * 0.99);

        let finalDealPrice = baseOffer;
        let aiLog = '';
        let aiMessage = '';

        if (negotiationText) {
            try {
                const groq = getGroqClient();
                const systemPrompt = `You are a pawn shop broker for WAF Casino. A user wants to sell their ${propertyName}.
The original price was ${originalPrice}. The standard base offer is ${baseOffer}. The maximum you can ever offer is ${hardCap}.
The user will try to negotiate a better deal. Evaluate their persuasion tactics. 
You can concede slightly if their argument is good, but you must NEVER exceed ${hardCap}.
You must call the 'finalize_deal' function to return your response.`;

                const completion = await groq.chat.completions.create({
                    model: 'llama3-8b-8192',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: negotiationText }
                    ],
                    tools: [
                        {
                            type: 'function',
                            function: {
                                name: 'finalize_deal',
                                description: 'Finalize the deal price and provide a message to the user.',
                                parameters: {
                                    type: 'object',
                                    properties: {
                                        deal_price: {
                                            type: 'integer',
                                            description: 'The final agreed price in Rupiah.'
                                        },
                                        broker_message: {
                                            type: 'string',
                                            description:
                                                'Your response to the user in formal English explaining why you accept or reject their terms.'
                                        }
                                    },
                                    required: ['deal_price', 'broker_message']
                                }
                            }
                        }
                    ],
                    tool_choice: { type: 'function', function: { name: 'finalize_deal' } },
                    temperature: 0.1
                });

                const toolCall = completion.choices[0]?.message?.tool_calls?.[0];
                if (toolCall && toolCall.function.name === 'finalize_deal') {
                    const parsed = JSON.parse(toolCall.function.arguments);
                    finalDealPrice = parseInt(parsed.deal_price);
                    aiMessage = parsed.broker_message;
                    aiLog = toolCall.function.arguments;

                    // Enforce Hard Cap explicitly in code
                    if (finalDealPrice > hardCap) {
                        finalDealPrice = hardCap;
                    }
                    if (finalDealPrice < baseOffer * 0.5) {
                        // Sanity check lowballing
                        finalDealPrice = baseOffer;
                    }
                } else {
                    throw new Error('Groq did not return the expected tool call.');
                }
            } catch (err) {
                console.error('Groq negotiation failed:', err);
                aiMessage = 'I am currently unable to negotiate. I will give you the standard base offer.';
            }
        }

        // Process transaction
        await prisma.$transaction(async (tx) => {
            // Add funds to user
            await tx.user.update({
                where: { id: actualUserId },
                data: { balance: { increment: BigInt(finalDealPrice) } }
            });

            // Update inventory status
            await tx.userInventory.update({
                where: { id: inventoryItem.id },
                data: { ownershipStatus: 'Sold' }
            });

            // Log transaction
            await tx.propertyTransaction.create({
                data: {
                    userId: actualUserId,
                    propertyId: inventoryItem.propertyId,
                    transactionType: 'Sell',
                    amount: BigInt(finalDealPrice),
                    aiNegotiationLog: aiLog || null
                }
            });
        });

        let responseText = `*🤝 Property Sold*\n\n`;
        responseText += `You sold *${inventoryItem.name}*.\n`;
        responseText += `Original Price: ${formatRupiah(originalPrice)}\n`;
        responseText += `Base Offer: ${formatRupiah(baseOffer)}\n`;

        if (negotiationText) {
            responseText += `Negotiated Deal Price: ${formatRupiah(finalDealPrice)}\n\n`;
            responseText += `*Broker says:* "${aiMessage}"`;
        } else {
            responseText += `Final Deal Price: ${formatRupiah(finalDealPrice)}\n\n`;
            responseText += `_You can negotiate the price by using: /sell ${propertyName} | <your persuasion message>_`;
        }

        await sock.sendMessage(jid, { text: responseText }, { quoted: msg });
    }
};

export default propertySellTool;
