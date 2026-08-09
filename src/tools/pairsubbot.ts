import { ToolDefinition, ToolContext } from './types.js';
import { connectToWhatsApp, activeConnections } from '#/utils/connectionManager.js';

export const definition: ToolDefinition = {
    name: 'pair_subbot',
    title: 'Pair Sub Bot',
    category: 'System & Help',
    aliases: ['.pair', '.subbot', '.clonebot'],
    description: 'Pair your WhatsApp number to become a sub-bot.',
    parameters: {
        type: 'object',
        properties: {
            phone_number: {
                type: 'string',
                description: 'The phone number to pair (e.g., 628123456789). Must include country code without +.'
            }
        },
        required: ['phone_number']
    }
};

export async function execute(args: Record<string, any>, _ctx: ToolContext): Promise<string> {
    const phoneNumber = args.phone_number?.replace(/\D/g, '');
    if (!phoneNumber) {
        return 'Please provide a valid phone number with country code.';
    }

    const sessionId = `subbot_${phoneNumber}`;

    if (activeConnections.has(sessionId)) {
        return `Number ${phoneNumber} is already connected or currently trying to connect.`;
    }

    try {
        const pairingCode = await new Promise<string>((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Timeout waiting for pairing code. Please try again.'));
            }, 45000); // 45 seconds timeout

            connectToWhatsApp({
                sessionId,
                phoneNumber,
                onPairingCode: (code) => {
                    clearTimeout(timeout);
                    resolve(code);
                },
                onConnected: () => {
                    clearTimeout(timeout);
                    resolve('ALREADY_CONNECTED');
                },
                onClosed: (_isLoggedOut) => {
                    // This could be called if connection fails before pairing code
                    // Wait, we don't want to reject unless it's a fatal error
                }
            }).catch((err) => {
                clearTimeout(timeout);
                reject(err);
            });
        });

        if (pairingCode === 'ALREADY_CONNECTED') {
            return `Number ${phoneNumber} is already paired and connected as a sub-bot!`;
        }

        return [
            `*🤖 SUB-BOT PAIRING CODE*`,
            ``,
            `*Phone Number:* ${phoneNumber}`,
            `*Pairing Code:* ${pairingCode}`,
            ``,
            `Please enter this code in your WhatsApp -> Linked Devices -> Pair a device.`
        ].join('\n');
    } catch (err: any) {
        return `Failed to pair sub-bot: ${err.message || err}`;
    }
}
