import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

class ToolsHandler {
    constructor() {
        this.tools = new Map();
        this.aliases = new Map();
    }

    async loadTools() {
        const toolsPath = path.resolve(process.cwd(), 'src', 'tools');
        if (!fs.existsSync(toolsPath)) return;

        const files = fs.readdirSync(toolsPath).filter((f) => f.endsWith('.js') && f !== 'handler.js');
        for (const file of files) {
            const fileUrl = pathToFileURL(path.join(toolsPath, file)).href;
            const toolModule = await import(fileUrl);
            if (toolModule.definition && toolModule.execute) {
                const { name, aliases } = toolModule.definition;
                this.tools.set(name, toolModule);
                if (aliases && Array.isArray(aliases)) {
                    for (const alias of aliases) {
                        this.aliases.set(alias, name);
                    }
                }
            }
        }
    }

    getTool(nameOrAlias) {
        if (this.tools.has(nameOrAlias)) {
            return this.tools.get(nameOrAlias);
        }
        const name = this.aliases.get(nameOrAlias);
        if (name) {
            return this.tools.get(name);
        }
        return null;
    }

    getGroqTools() {
        const groqTools = [];
        for (const toolModule of this.tools.values()) {
            groqTools.push({
                type: 'function',
                function: toolModule.definition
            });
        }
        return groqTools;
    }

    async execute(nameOrAlias, args, ctx) {
        const tool = this.getTool(nameOrAlias);
        if (!tool) throw new Error(`Tool not found: ${nameOrAlias}`);
        return await tool.execute(args, ctx);
    }
}

const toolsHandler = new ToolsHandler();
await toolsHandler.loadTools();
export default toolsHandler;
