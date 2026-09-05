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
        properties: {
            category: {
                type: 'string',
                description: 'The specific category to show the menu for'
            }
        },
        required: []
    }
};

export async function execute(args: Record<string, any>, ctx: ToolContext): Promise<string> {
    const toolsHandler = (await import('./handler.js')).default;
    const tools = toolsHandler.getAllTools();

    const textMessage = ctx.msg.message?.conversation || ctx.msg.message?.extendedTextMessage?.text || '';
    const commandUsed = textMessage.trim().split(/\s+/)[0].toLowerCase();
    const cmdPrefix = commandUsed === '.menu' || commandUsed === '.bantuan' ? commandUsed : '.help';

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
            new Set(rawAliases.map((a) => (a.startsWith('.') ? a : `.${a}`)).map((a) => a.toLowerCase()))
        );

        categorizedTools[category].push({
            name: def.name,
            title: def.title || def.name.toUpperCase(),
            description: def.description || 'No description available.',
            aliases: formattedAliases,
            owner: def.owner
        });
    }

    const categories = Object.keys(categorizedTools);
    const requestedCategory = typeof args.category === 'string' ? args.category.trim().toLowerCase() : '';

    if (requestedCategory) {
        const matchedCategory = categories.find(
            (c) => c.toLowerCase() === requestedCategory || c.toLowerCase().includes(requestedCategory)
        );

        if (matchedCategory) {
            let menuText = `*Cosmos - ${matchedCategory.toUpperCase()} MENU*\n\n`;
            const toolsInCategory = categorizedTools[matchedCategory];

            toolsInCategory.forEach((t, tIndex) => {
                const primaryCommand = t.aliases.length > 0 ? t.aliases[0] : `.${t.name}`;
                const ownerBadge = t.owner ? ' *(Owner)*' : '';
                const aliasStr =
                    t.aliases.length > 0
                        ? t.aliases.map((a) => `\`\`\`${a}\`\`\``).join(', ')
                        : `\`\`\`.${t.name}\`\`\``;

                menuText += `\`\`\`${primaryCommand}\`\`\`${ownerBadge}\n`;
                menuText += `Alias: ${aliasStr}\n`;
                menuText += `Desc: ${t.description}`;

                if (tIndex !== toolsInCategory.length - 1) {
                    menuText += '\n\n';
                }
            });

            menuText += `\n\n*Tip:* Use \`\`\`${cmdPrefix}\`\`\` to see all available categories.`;
            return menuText.trim();
        } else {
            return `*Error:* Category '${args.category}' not found.\n\n*Available Categories:*\n${categories.map((c) => `- ${c}`).join('\n')}`;
        }
    }

    let menuText = `*Cosmos - COMMAND CATEGORIES*\n\n`;
    categories.forEach((cat) => {
        menuText += `\`\`\`${cmdPrefix} ${cat}\`\`\`\n`;
    });

    menuText += `\n*Tip:* Type \`\`\`${cmdPrefix} <category>\`\`\` to view the commands in that category (e.g. \`\`\`${cmdPrefix} media\`\`\`).`;

    return menuText.trim();
}
