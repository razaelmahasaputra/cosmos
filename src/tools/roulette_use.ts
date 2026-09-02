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

        let targetId = '';

        const mentionedJidList = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        if (mentionedJidList.length > 0) {
            targetId = await resolveId(mentionedJidList[0], sock, msg.key.remoteJid);
        }

        let itemType: ItemType | undefined;
        if (inputStr.includes('cola') || inputStr.includes('beer')) itemType = 'COLA';
        else if (inputStr.includes('magnifying') || inputStr.includes('glass')) itemType = 'MAGNIFYING_GLASS';
        else if (inputStr.includes('saw') || inputStr.includes('handsaw')) itemType = 'HAND_SAW';
        else if (inputStr.includes('handcuff') || inputStr.includes('cuff')) itemType = 'HANDCUFFS';
        else if (inputStr.includes('cigarette') || inputStr.includes('cigar')) itemType = 'CIGARETTES';
        else if (inputStr.includes('inverter')) itemType = 'INVERTER';

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
                outputMsg = `🍺 @${currentPlayer.pushName} used ${itemType === 'COLA' ? 'Cola' : 'Cigarettes'}!\n❤️ Lives restored (+1 Heart).\nCurrent lives: [${'❤️'.repeat(currentPlayer.hp)}${'🖤'.repeat(5 - currentPlayer.hp)}]`;
                break;
            case 'HAND_SAW':
                currentPlayer.handSawActive = true;
                outputMsg = `🪚 @${currentPlayer.pushName} sawed off the barrel! Next shell damage is x2.`;
                break;
            case 'HANDCUFFS': {
                if (!targetId) return `❌ Use the format: .use handcuffs @target`;
                const target = session.players.find((p) => p.userId === targetId);
                if (target && target.hp > 0) {
                    target.isHandcuffed = true;
                    outputMsg = `🔗 @${currentPlayer.pushName} handcuffed @${target.pushName}!\nTheir next turn will be skipped.`;
                } else {
                    return `❌ Target is invalid or eliminated.`;
                }
                break;
            }
            case 'MAGNIFYING_GLASS': {
                outputMsg = `🔍 @${currentPlayer.pushName} uses the *Magnifying Glass*!`;
                await sock.sendMessage(jid, { text: outputMsg, mentions: [senderJid] });
                const shell = session.shells[session.shells.length - 1];
                try {
                    await sock.sendMessage(senderJid, {
                        text: `🔍 *Magnifying Glass Result:*\nThe current shell in the barrel is: *${shell}*`
                    });
                } catch {
                    await sock.sendMessage(jid, {
                        text: `⚠️ *FAILED TO SEND DM!*\n@${currentPlayer.pushName}, the Bot cannot send a private message to your number!\nThe *Magnifying Glass* was wasted with no result!`,
                        mentions: [senderJid]
                    });
                }
                return null;
            }
            case 'INVERTER': {
                const current = session.shells[session.shells.length - 1];
                session.shells[session.shells.length - 1] = current === 'LIVE' ? 'BLANK' : 'LIVE';
                outputMsg = `🔄 @${currentPlayer.pushName} used the Inverter!\nThe current shell's polarity has been swapped.`;
                break;
            }
        }

        const mentions = session.players.map((p) => p.userId);
        await sock.sendMessage(jid, { text: outputMsg, mentions });
        return null;
    }
};

export default useTool;
