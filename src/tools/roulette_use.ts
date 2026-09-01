import { ToolModule, ToolContext } from './types.js';
import { getSessionByChatId, ItemType } from '../utils/roulette.js';
import { getSenderJid, resolveId } from '../utils/casino.js';

const useTool: ToolModule = {
    definition: {
        name: 'use',
        description: 'Use an item in Buckshot Roulette',
        category: 'Games',
        parameters: {
            type: 'object',
            properties: {
                input: { type: 'string', description: 'Item name and target (if applicable)' }
            },
            required: ['input']
        }
    },
    execute: async (args: Record<string, any>, ctx: ToolContext) => {
        const { msg, sock, jid } = ctx;
        const senderJid = getSenderJid(msg);
        const inputStr = String(args.input || '')
            .trim()
            .toLowerCase();

        const session = getSessionByChatId(jid);
        if (!session || session.status !== 'PLAYING') {
            return `❌ No active Buckshot Roulette game in this group.`;
        }

        const currentPlayer = session.players[session.turnIndex];
        if (currentPlayer.userId !== senderJid) {
            return `❌ It's not your turn!`;
        }

        if (currentPlayer.hasUsedItemThisTurn) {
            return `❌ You have already used an item this turn! You must shoot.`;
        }

        const itemNameRaw = inputStr.split(' ')[0];
        let targetId = '';

        const mentionedJidList = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        if (mentionedJidList.length > 0) {
            targetId = resolveId(mentionedJidList[0]);
        }

        let itemType: ItemType | undefined;
        if (itemNameRaw === 'cola' || itemNameRaw === 'beer') itemType = 'COLA';
        else if (itemNameRaw === 'magnifying' || itemNameRaw === 'glass') itemType = 'MAGNIFYING_GLASS';
        else if (itemNameRaw === 'saw' || itemNameRaw === 'handsaw') itemType = 'HAND_SAW';
        else if (itemNameRaw === 'handcuffs') itemType = 'HANDCUFFS';
        else if (itemNameRaw === 'cigarettes' || itemNameRaw === 'cigar') itemType = 'CIGARETTES';
        else if (itemNameRaw === 'inverter') itemType = 'INVERTER';

        if (!itemType) {
            return `❌ Invalid item.`;
        }

        const itemIndex = currentPlayer.inventory.indexOf(itemType);
        if (itemIndex === -1) {
            return `❌ You don't have that item in your inventory.`;
        }

        currentPlayer.inventory.splice(itemIndex, 1);
        currentPlayer.hasUsedItemThisTurn = true;
        session.lastActionAt = Date.now();

        let outputMsg = '';

        switch (itemType) {
            case 'COLA':
            case 'CIGARETTES':
                if (currentPlayer.hp < 5) currentPlayer.hp++;
                outputMsg = `🍺 @${senderJid.split('@')[0]} used ${itemType === 'COLA' ? 'Cola' : 'Cigarettes'}!\n❤️ Lives restored (+1 Heart).\nCurrent lives: [${'❤️'.repeat(currentPlayer.hp)}${'🖤'.repeat(5 - currentPlayer.hp)}]`;
                break;
            case 'HAND_SAW':
                currentPlayer.handSawActive = true;
                outputMsg = `🪚 @${senderJid.split('@')[0]} sawed off the barrel! Next shell damage is x2.`;
                break;
            case 'HANDCUFFS': {
                if (!targetId) return `❌ Use the format: .use handcuffs @target`;
                const target = session.players.find((p) => p.userId === targetId);
                if (target && target.hp > 0) {
                    target.isHandcuffed = true;
                    outputMsg = `🔗 @${senderJid.split('@')[0]} handcuffed @${targetId.split('@')[0]}!\nTheir next turn will be skipped.`;
                } else {
                    return `❌ Target is invalid or eliminated.`;
                }
                break;
            }
            case 'MAGNIFYING_GLASS': {
                outputMsg = `🔍 @${senderJid.split('@')[0]} uses the *Magnifying Glass*!`;
                await sock.sendMessage(jid, { text: outputMsg, mentions: [senderJid] });
                const shell = session.shells[session.shells.length - 1];
                try {
                    await sock.sendMessage(senderJid, {
                        text: `🔍 *Magnifying Glass Result:*\nThe current shell in the barrel is: *${shell}*`
                    });
                } catch {
                    await sock.sendMessage(jid, {
                        text: `⚠️ *FAILED TO SEND DM!*\n@${senderJid.split('@')[0]}, the Bot cannot send a private message to your number!\nThe *Magnifying Glass* was wasted with no result!`,
                        mentions: [senderJid]
                    });
                }
                return null;
            }
            case 'INVERTER': {
                const current = session.shells[session.shells.length - 1];
                session.shells[session.shells.length - 1] = current === 'LIVE' ? 'BLANK' : 'LIVE';
                outputMsg = `🔄 @${senderJid.split('@')[0]} used the Inverter!\nThe current shell's polarity has been swapped.`;
                break;
            }
        }

        const mentions = session.players.map((p) => p.userId);
        await sock.sendMessage(jid, { text: outputMsg, mentions });
        return null;
    }
};

export default useTool;
