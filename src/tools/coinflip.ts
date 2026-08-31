import { ToolModule, ToolContext } from './types.js';
import { prisma } from '../db.js';
import { cleanId } from '../utils/casino.js';
import { getUser, parseBet, executeGamble } from '../utils/casino.js';

const coinflipTool: ToolModule = {
    definition: {
        name: 'coinflip',
        description: 'Play coinflip. Example: .coinflip heads 100',
        category: 'Casino',
        parameters: {
            type: 'object',
            properties: {
                input: { type: 'string', description: 'Your guess (heads/tails) and bet amount' }
            },
            required: ['input']
        }
    },
    execute: async (args: Record<string, any>, ctx: ToolContext) => {
        const { msg, sock, jid } = ctx;
        const senderJid = cleanId(msg.key.participant || msg.key.remoteJid!);

        const pushName = msg.pushName || undefined;
        const user = await getUser(prisma, senderJid, pushName);

        const inputStr = String(args.input || '')
            .trim()
            .toLowerCase();

        let guess = '';
        if (
            inputStr.includes('kepala') ||
            inputStr.includes('heads') ||
            inputStr.includes('head') ||
            inputStr.includes('h')
        ) {
            guess = 'heads';
        } else if (
            inputStr.includes('ekor') ||
            inputStr.includes('tails') ||
            inputStr.includes('tail') ||
            inputStr.includes('t')
        ) {
            guess = 'tails';
        }

        if (!guess) {
            return `❌ Please specify your guess (heads/tails). Example: .coinflip heads 100`;
        }

        // Remove the guess word to parse the bet
        const betStr = inputStr.replace(/kepala|ekor|heads?|tails?|h|t/g, '').trim();
        const bet = parseBet(betStr, user.balance);

        if (bet === null) {
            return `❌ Invalid bet amount. Minimum bet is 10 coins.`;
        }

        // Coinflip probabilities: 30% win, 70% lose
        const result = await executeGamble(prisma, senderJid, bet, 2, 30, 70);

        if (!result.success) {
            return `❌ ${result.error}`;
        }

        const flipped = result.isWin ? guess : guess === 'heads' ? 'tails' : 'heads';
        const flippedEmoji = flipped === 'heads' ? '🦅 (Heads)' : '🪙 (Tails)';

        const winMsg = result.isWin
            ? `🎉 *You Win!* You earned *${result.winAmount}* coins!`
            : `💀 *You Lose!* You lost *${bet}* coins.`;

        const text =
            `🪙 *COINFLIP* 🪙\n\n` +
            `You guessed: *${guess.toUpperCase()}*\n` +
            `Coin landed on: *${flippedEmoji}*\n\n` +
            `${winMsg}\n` +
            `Current Balance: *${result.newBalance}* coins`;

        await new Promise((resolve) => setTimeout(resolve, 3000));
        await sock.sendMessage(jid, { text }, { quoted: msg });
    }
};

export default coinflipTool;
