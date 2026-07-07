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
            try {
                const fileUrl = pathToFileURL(path.join(toolsPath, file)).href;
                const toolModule = await import(fileUrl);
                if (toolModule.definition && toolModule.execute) {
                    const { name, aliases } = toolModule.definition;
                    const normalizedName = name.toLowerCase();
                    this.tools.set(normalizedName, toolModule);
                    if (aliases && Array.isArray(aliases)) {
                        for (const alias of aliases) {
                            const normalizedAlias = alias.toLowerCase();
                            this.aliases.set(normalizedAlias, normalizedName);
                        }
                    }
                }
            } catch (err) {
                console.error(`Gagal memuat tool ${file}:`, err);
            }
        }
    }

    getTool(nameOrAlias) {
        if (!nameOrAlias) return null;
        const normalized = nameOrAlias.trim().toLowerCase();

        // 1. Coba cari langsung dengan input mentah yang di-lowercase
        if (this.tools.has(normalized)) {
            return this.tools.get(normalized);
        }
        if (this.aliases.has(normalized)) {
            const name = this.aliases.get(normalized);
            return this.tools.get(name);
        }

        // 2. Jika input tidak diawali titik, coba cari dengan titik di depannya
        if (!normalized.startsWith('.')) {
            const dotted = '.' + normalized;
            if (this.tools.has(dotted)) {
                return this.tools.get(dotted);
            }
            if (this.aliases.has(dotted)) {
                const name = this.aliases.get(dotted);
                return this.tools.get(name);
            }
        }

        // 3. Jika input diawali titik, coba cari tanpa titik
        if (normalized.startsWith('.')) {
            const undotted = normalized.slice(1);
            if (this.tools.has(undotted)) {
                return this.tools.get(undotted);
            }
            if (this.aliases.has(undotted)) {
                const name = this.aliases.get(undotted);
                return this.tools.get(name);
            }
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
