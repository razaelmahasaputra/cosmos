import { ToolDefinition, ToolContext } from './types.js';

export const definition: ToolDefinition = {
    name: 'help',
    title: 'Command Help Menu',
    category: 'System & Help',
    aliases: ['.help', '.menu', '.bantuan'],
    description:
        'Displays the list of all available bot commands dynamically grouped by category with titles, descriptions, and aliases.',
    parameters: {
        type: 'object',
        properties: {},
        required: []
    }
};

export async function execute(_args: Record<string, any>, _ctx: ToolContext): Promise<string> {
    const toolsHandler = (await import('./handler.js')).default;
    const tools = toolsHandler.getAllTools();

    interface ProcessedTool {
        name: string;
        title: string;
        description: string;
        aliases: string[];
        owner?: boolean;
    }

    const categorizedTools: Record<string, ProcessedTool[]> = {};
    const seenNames = new Set<string>();

    for (const tool of tools) {
        const def = tool.definition;
        if (!def || seenNames.has(def.name)) continue;
        seenNames.add(def.name);

        const category = def.category || 'General Commands';
        if (!categorizedTools[category]) {
            categorizedTools[category] = [];
        }

        const rawAliases = def.aliases || [];
        const formattedAliases = Array.from(
            new Set(
                rawAliases.map((a) => (a.startsWith('.') ? a : `.${a}`)).map((a) => a.toLowerCase())
            )
        );

        categorizedTools[category].push({
            name: def.name,
            title: def.title || def.name.toUpperCase(),
            description: def.description || 'No description available.',
            aliases: formattedAliases,
            owner: def.owner
        });
    }

    let menuText = `🤖 *WAF (WhatsApp Bot Framework) - COMMAND MENU*\n`;
    menuText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    const categories = Object.keys(categorizedTools);

    categories.forEach((cat) => {
        menuText += `📂 *${cat.toUpperCase()}*\n`;

        categorizedTools[cat].forEach((t) => {
            const primaryCommand = t.aliases.length > 0 ? t.aliases[0] : `.${t.name}`;
            const ownerBadge = t.owner ? ' 🔒 *(Owner Only)*' : '';
            const aliasStr =
                t.aliases.length > 0 ? t.aliases.join(', ') : `.${t.name}`;

            menuText += `• *${t.title}* (${primaryCommand})${ownerBadge}\n`;
            menuText += `  📝 *Description:* ${t.description}\n`;
            menuText += `  🏷️ *Aliases:* ${aliasStr}\n\n`;
        });
    });

    menuText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    menuText += `💡 *Tip:* Execute commands by typing their dot prefix (e.g. \`.help\`, \`.sticker\`).`;

    return menuText;
}
