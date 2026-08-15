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

    const readmore = String.fromCharCode(8206).repeat(4001);
    let menuText = `*WAF - COMMAND MENU*\n\n`;

    const categories = Object.keys(categorizedTools);

    categories.forEach((cat, catIndex) => {
        menuText += `*${cat.toUpperCase()}*\n\n`;

        const toolsInCategory = categorizedTools[cat];

        toolsInCategory.forEach((t, tIndex) => {
            const primaryCommand = t.aliases.length > 0 ? t.aliases[0] : `.${t.name}`;
            const ownerBadge = t.owner ? ' *(Owner)*' : '';
            const aliasStr =
                t.aliases.length > 0 ? t.aliases.map(a => `\`\`\`${a}\`\`\``).join(', ') : `\`\`\`.${t.name}\`\`\``;

            menuText += `\`\`\`${primaryCommand}\`\`\`${ownerBadge}\n`;
            menuText += `Alias: ${aliasStr}\n`;
            menuText += `Desc: ${t.description}`;

            const isLastCategory = catIndex === categories.length - 1;
            const isLastToolInCategory = tIndex === toolsInCategory.length - 1;
            const isVeryLastCommand = isLastCategory && isLastToolInCategory;

            if (!isVeryLastCommand) {
                if (isLastToolInCategory) {
                    menuText += `\n\n${readmore}\n\n`;
                } else {
                    menuText += '\n\n';
                }
            }
        });
    });

    menuText += `\n\n*Tip:* Use the dot prefix to execute (e.g. \`\`\`.help\`\`\`).`;

    return menuText.trim();
}
