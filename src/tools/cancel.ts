import { ToolDefinition, ToolContext, ToolModule } from './types.js';
import { getSenderJid } from '#/utils/casino.js';
import { cancelActiveSession } from '#/utils/cancellationManager.js';

export const definition: ToolDefinition = {
    name: 'cancel',
    title: 'Cancel Operation',
    category: 'General',
    aliases: ['batal', 'abort'],
    description:
        'Cancel an active multi-step operation, interactive prompt, or pending confirmation in the current chat.',
    parameters: {
        type: 'object',
        properties: {
            reason: {
                type: 'string',
                description: 'Optional reason for cancellation.'
            }
        }
    }
};

export async function execute(args: Record<string, any>, ctx: ToolContext): Promise<string | void> {
    const senderJid = getSenderJid(ctx.msg, ctx.sock);
    if (!senderJid) {
        return 'Could not determine your sender identity.';
    }

    const cancelled = await cancelActiveSession(senderJid, ctx.jid, ctx.sock, ctx.msg);
    if (cancelled) {
        return cancelled;
    }

    return 'You do not have any active operation or pending confirmation to cancel in this chat.';
}

const cancelTool: ToolModule = {
    definition,
    execute
};

export default cancelTool;
