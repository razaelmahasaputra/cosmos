import { ToolDefinition, ToolContext } from './types.js';

export const definition: ToolDefinition = {
    name: 'help',
    aliases: ['.help', 'help', '.menu', 'menu', '.bantuan', 'bantuan'],
    description: 'Displays the list of all available bot commands along with their descriptions and aliases.',
    parameters: {
        type: 'object',
        properties: {},
        required: []
    }
};

export async function execute(_args: Record<string, any>, _ctx: ToolContext): Promise<string> {
    const toolsHandler = (await import('./handler.js')).default;
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
            description: def.description || 'No description available.',
            aliases: formattedAliases,
            owner: def.owner
        });
    }

    let menuText = `🤖 *WAF (WhatsApp Bot Framework) - COMMAND MENU*\n\n`;
    menuText += `Below is the list of available commands:\n\n`;

    toolList.forEach((t, index) => {
        const primaryCommand = t.aliases.length > 0 ? t.aliases[0] : `.${t.name}`;
        const ownerTag = t.owner ? ' 🔒 *(Owner Only)*' : '';

        menuText += `${index + 1}. *${primaryCommand}*${ownerTag}\n`;
        menuText += `   📝 *Description:* ${t.description}\n`;
        if (t.aliases.length > 0) {
            menuText += `   🏷️ *Aliases:* ${t.aliases.join(', ')}\n`;
        }
        menuText += `\n`;
    });

    menuText += `💡 *Tip:* Execute commands by adding a dot prefix (e.g., \`.help\`, \`.menu\`, \`.sticker\`).`;

    return menuText;
}
