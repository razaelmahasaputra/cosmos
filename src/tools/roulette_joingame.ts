import { ToolModule, ToolContext } from './types.js';
import { gameSessions, Player } from '../utils/roulette.js';
import { getSenderJid } from '../utils/casino.js';
import { prisma } from '../db.js';

const joinGameTool: ToolModule = {
    definition: {
        name: 'joingame',
        description: 'Join a Buckshot Roulette minigame session',
        category: 'Games',
        parameters: {
            type: 'object',
            properties: {
                input: { type: 'string', description: 'Session ID to join' }
            },
            required: ['input']
        }
    },
    execute: async (args: Record<string, any>, ctx: ToolContext) => {
        const { msg } = ctx;
        const senderJid = getSenderJid(msg);
        const sessionId = String(args.input || '')
            .trim()
            .toUpperCase();

        if (!sessionId) {
            return `❌ Please provide a Session ID. Example: .joingame A1X9B`;
        }

        const session = gameSessions.get(sessionId);
        if (!session) {
            return `❌ Session not found or has already ended.`;
        }

        if (session.status !== 'LOBBY') {
            return `❌ The game has already started.`;
        }

        if (session.players.length >= 5) {
            return `❌ The room is full (Maximum 5 players).`;
        }

        if (session.players.find((p) => p.userId === senderJid)) {
            return `❌ You are already in this room!`;
        }

        const user = await prisma.user.findUnique({ where: { id: senderJid } });
        const roundCount = user?.rouletteRounds || 0;

        const newPlayer: Player = {
            userId: senderJid,
            pushName: msg.pushName || senderJid.split('@')[0],
            hp: 5,
            inventory: [],
            betAmount: 0,
            isHandcuffed: false,
            hasUsedItemThisTurn: false,
            handSawActive: false,
            isAfk: false
        };

        session.players.push(newPlayer);

        const creator = session.players[0];
        const creatorData = await prisma.user.findUnique({ where: { id: creator.userId } });
        const creatorRounds = creatorData?.rouletteRounds || 0;

        let playerList = '';
        session.players.forEach((p, idx) => {
            const prefix = idx === 0 ? '👑 ' : '';
            const rounds = idx === 0 ? creatorRounds : p.userId === senderJid ? roundCount : 0; // Quick hack to show rounds
            playerList += `${idx + 1}. ${prefix}@${p.pushName} (${rounds} Rounds)\n`;
        });

        const numPlayers = session.players.length;
        const betters = session.players.filter((p) => p.betAmount > 0).length;

        return `📥 @${newPlayer.pushName} has joined the room!\n👥 *Players (${numPlayers}/5):*\n${playerList.trim()}\n\n💰 *Current Pot:* Rp ${session.potAmount.toLocaleString('id-ID')} (From ${betters} Player${betters > 1 ? 's' : ''})\n\n⚠️ Don't forget to place your bets!\n👉 Type *.bet <amount>* (Min. Rp 450,000)`;
    }
};

export default joinGameTool;
