import { ToolDefinition, ToolContext } from './types.js';
import toolsHandler from './handler.js';

export const definition: ToolDefinition = {
    name: 'help',
    aliases: ['.help', 'help', '.menu', 'menu', '.bantuan', 'bantuan'],
    description: 'Menampilkan daftar seluruh perintah (command) bot yang tersedia beserta deskripsi dan alias-aliasnya.',
    parameters: {
        type: 'object',
        properties: {},
        required: []
    }
};

export async function execute(_args: Record<string, any>, _ctx: ToolContext): Promise<string> {
    const tools = toolsHandler.getAllTools();

    const toolList: { name: string; description: string; aliases: string[]; owner?: boolean }[] = [];
    const seenNames = new Set<string>();

    for (const tool of tools) {
        const def = tool.definition;
        if (!def || seenNames.has(def.name)) continue;
        seenNames.add(def.name);

        const rawAliases = def.aliases || [];
        const formattedAliases = Array.from(
            new Set(
                rawAliases
                    .map((a) => (a.startsWith('.') ? a : `.${a}`))
                    .map((a) => a.toLowerCase())
            )
        );

        toolList.push({
            name: def.name,
            description: def.description || 'Tidak ada deskripsi.',
            aliases: formattedAliases,
            owner: def.owner
        });
    }

    let menuText = `🤖 *WAF (WhatsApp Bot Framework) - MENU PERINTAH*\n\n`;
    menuText += `Berikut adalah daftar perintah yang tersedia:\n\n`;

    toolList.forEach((t, index) => {
        const primaryCommand = t.aliases.length > 0 ? t.aliases[0] : `.${t.name}`;
        const ownerTag = t.owner ? ' 🔒 *(Owner Only)*' : '';

        menuText += `${index + 1}. *${primaryCommand}*${ownerTag}\n`;
        menuText += `   📝 *Deskripsi:* ${t.description}\n`;
        if (t.aliases.length > 0) {
            menuText += `   🏷️ *Alias:* ${t.aliases.join(', ')}\n`;
        }
        menuText += `\n`;
    });

    menuText += `💡 *Tips:* Jalankan perintah dengan menggunakan titik di depan command (contoh: \`.help\`, \`.menu\`, \`.sticker\`).`;

    return menuText;
}
