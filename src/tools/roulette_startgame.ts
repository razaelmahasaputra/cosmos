import { ToolModule, ToolContext } from './types.js';
import { getSessionByChatId, generateShells, getRandomItems } from '../utils/roulette.js';
import { getSenderJid } from '../utils/casino.js';
import { formatRupiah } from '../utils/currency.js';

const startGameTool: ToolModule = {
    definition: {
        name: 'startgame',
        description: 'Start the Buckshot Roulette minigame',
        category: 'Games'
    },
    execute: async (args: Record<string, any>, ctx: ToolContext) => {
        const { msg, sock, jid } = ctx;
        const senderJid = getSenderJid(msg, sock);

        const session = getSessionByChatId(jid);
        if (!session) {
            return `❌ No active game session in this group.`;
        }

        if (session.status !== 'LOBBY') {
            return `❌ The game has already started.`;
        }

        if (session.players[0].userId !== senderJid) {
            return `❌ Only the room creator can start the game.`;
        }

        if (session.players.length < 2) {
            return `❌ Minimum 2 players are required to start the game.`;
        }

        // Check if all players have bet
        const nonBetters = session.players.filter((p) => p.betAmount === 0);
        if (nonBetters.length > 0) {
            const names = nonBetters.map((p) => `@${p.pushName}`).join(', ');
            return `❌ Failed to start game! User ${names} has not placed a bet.`;
        }

        // Clear timeout
        if (session.timeoutId) {
            clearTimeout(session.timeoutId);
            session.timeoutId = undefined;
        }

        session.status = 'PLAYING';
        session.shells = generateShells();
        session.turnIndex = 0;
        session.lastActionAt = Date.now();

        // Give items
        for (const player of session.players) {
            player.inventory.push(...getRandomItems(2));
        }

        const startMsg = `🚀 *GAME STARTED!*\nTotal Players: ${session.players.length}\n💰 *Total Bet Pot:* ${formatRupiah(session.potAmount)}\n\n*Dealer (Bot)* is preparing the table and weapons...\nGood luck! 💀`;
        await sock.sendMessage(jid, { text: startMsg });

        // Delay before announcing round 1
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const liveCount = session.shells.filter((s) => s === 'LIVE').length;
        const blankCount = session.shells.length - liveCount;

        const firstPlayer = session.players[session.turnIndex];
        const inventoryStr =
            firstPlayer.inventory.length > 0
                ? firstPlayer.inventory.map((i) => i.replace('_', ' ')).join(', ')
                : 'Empty';

        const roundMsg = `🔄 *ROUND 1 BEGINS* 🔄\n\n*Dealer* loads shells into the shotgun...\n🔴 *Live:* ${liveCount}\n⚪ *Blank:* ${blankCount}\n*(Total ${session.shells.length} shells shuffled mysteriously...)*\n\n📦 *Item Distribution:* Each player receives 2 random items!\n\n👇 *TURN:* 👑 @${firstPlayer.pushName}\n❤️ Lives: [${'❤️'.repeat(firstPlayer.hp)}${'🖤'.repeat(5 - firstPlayer.hp)}]\n🎒 Inventory: ${inventoryStr}\n🔥 *Active Status:* None\n\nAvailable actions:\n🔫 *.shoot @user* - Shoot another player\n🔫 *.shoot me* - Shoot yourself\n🛠️ *.use <item> [@target]* - Use an item (Max. 1 Item/Turn)`;

        return roundMsg;
    }
};

export default startGameTool;
