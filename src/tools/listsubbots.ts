import fs from 'fs';
import path from 'path';
import { ToolDefinition, ToolContext } from './types.js';
import { dbContext } from '#/db.js';
import { getAllSessionCategories } from '#/utils/prismaAuthState.js';
import { activeConnections } from '#/utils/connectionManager.js';

export const definition: ToolDefinition = {
    name: 'list_subbots',
    title: 'List Sub-Bots',
    category: 'System & Help',
    aliases: ['.subbots', '.listsubbots'],
    description: 'Displays a list of registered sub-bots (Main bot only).',
    owner: true,
    parameters: {
        type: 'object',
        properties: {},
        required: []
    }
};

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function censorNumber(phone: string): string {
    if (phone.length < 6) return '***';
    const start = phone.substring(0, 3);
    const end = phone.substring(phone.length - 3);
    const censored = '*'.repeat(phone.length - 6);
    return `${start}${censored}${end}`;
}

export async function execute(_args: Record<string, any>, _ctx: ToolContext): Promise<string> {
    const currentSession = dbContext.getStore()?.sessionId || 'default';
    
    if (currentSession !== 'default') {
        // Return empty string to remain completely hidden on sub-bots
        return '';
    }

    const categories = await getAllSessionCategories();
    const subbots = categories.filter(c => c.startsWith('subbot_'));
    
    if (subbots.length === 0) {
        return '*🤖 SUB-BOT SYSTEM*\n\nNo sub-bots are currently registered in the database.';
    }

    const storageDir = path.resolve(process.cwd(), 'storage');
    let message = `*🤖 SUB-BOT SYSTEM*\n_Total Registered Sub-bots: ${subbots.length}_\n\n`;

    for (let i = 0; i < subbots.length; i++) {
        const sessionId = subbots[i];
        const phone = sessionId.replace('subbot_', '');
        const censored = censorNumber(phone);
        
        let dbSize = 'Unknown';
        const dbPath = path.join(storageDir, `${sessionId}.sqlite`);
        if (fs.existsSync(dbPath)) {
            const stats = fs.statSync(dbPath);
            dbSize = formatBytes(stats.size);
        }

        const sock = activeConnections.get(sessionId);
        const status = sock ? '🟢 Online' : '🔴 Offline';
        const botName = sock?.user?.name || 'Unknown / Not synced';

        message += `*${i + 1}. Sub-Bot: ${censored}*\n`;
        message += `  • Status: ${status}\n`;
        message += `  • Display Name: ${botName}\n`;
        message += `  • Database Size: ${dbSize}\n`;
        message += `  • Session ID: ${sessionId}\n\n`;
    }

    return message.trim();
}
