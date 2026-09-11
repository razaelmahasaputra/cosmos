import { ToolDefinition, ToolContext } from './types.js';
import { getTranslator } from '#utils/i18n.js';

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
    const t = ctx?.t || getTranslator('en');
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

        const category = def.category || 'General';
        if (!categorizedTools[category]) {
            categorizedTools[category] = [];
        }

        categorizedTools[category].push({
            name: def.name,
            title: def.title || def.name,
            description: def.description || 'No description available.',
            aliases: def.aliases || [],
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
            let menuText = `${t('tools.help.category_menu_title', { category: matchedCategory.toUpperCase() })}\n\n`;
            const toolsInCategory = categorizedTools[matchedCategory];

            toolsInCategory.forEach((toolItem, tIndex) => {
                const primaryCommand = toolItem.aliases.length > 0 ? toolItem.aliases[0] : `.${toolItem.name}`;
                const ownerBadge = toolItem.owner ? t('tools.help.owner_badge') : '';
                const aliasStr =
                    toolItem.aliases.length > 0
                        ? toolItem.aliases.map((a) => `\`\`\`${a}\`\`\``).join(', ')
                        : `\`\`\`.${toolItem.name}\`\`\``;

                menuText += `\`\`\`${primaryCommand}\`\`\`${ownerBadge}\n`;
                menuText += `${t('tools.help.alias_label')}${aliasStr}\n`;
                menuText += `${t('tools.help.desc_label')}${toolItem.description}`;

                if (tIndex !== toolsInCategory.length - 1) {
                    menuText += '\n\n';
                }
            });

            menuText += `\n\n${t('tools.help.category_tip', { prefix: cmdPrefix })}`;
            return menuText.trim();
        } else {
            return t('tools.help.category_not_found', {
                category: args.category,
                available: categories.map((c) => `- ${c}`).join('\n')
            });
        }
    }

    let menuText = `${t('tools.help.categories_title')}\n\n`;
    categories.forEach((cat) => {
        menuText += `\`\`\`${cmdPrefix} ${cat}\`\`\`\n`;
    });

    menuText += `\n${t('tools.help.categories_tip', { prefix: cmdPrefix })}`;

    return menuText.trim();
}
