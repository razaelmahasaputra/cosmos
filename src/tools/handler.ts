import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { ToolModule, ToolContext } from './types.js';

class ToolsHandler {
    private tools = new Map<string, ToolModule>();
    private aliases = new Map<string, string>();

    async loadTools(): Promise<void> {
        const distToolsPath = path.resolve(process.cwd(), 'dist', 'tools');
        const srcToolsPath = path.resolve(process.cwd(), 'src', 'tools');
        const toolsPath = fs.existsSync(distToolsPath) ? distToolsPath : srcToolsPath;

        const files = fs
            .readdirSync(toolsPath)
            .filter(
                (f) =>
                    (f.endsWith('.js') || f.endsWith('.ts')) &&
                    !f.startsWith('handler.') &&
                    !f.startsWith('types.') &&
                    !f.endsWith('.d.ts')
            );
        for (const file of files) {
            try {
                const fileUrl = pathToFileURL(path.join(toolsPath, file)).href;
                const toolModule: ToolModule = await import(fileUrl);
                if (toolModule.definition && typeof toolModule.execute === 'function') {
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

    getTool(nameOrAlias?: string): ToolModule | null {
        if (!nameOrAlias) return null;
        const normalized = nameOrAlias.trim().toLowerCase();

        // 1. Coba cari langsung dengan input mentah yang di-lowercase
        if (this.tools.has(normalized)) {
            return this.tools.get(normalized) || null;
        }
        if (this.aliases.has(normalized)) {
            const name = this.aliases.get(normalized)!;
            return this.tools.get(name) || null;
        }

        // 2. Jika input tidak diawali titik, coba cari dengan titik di depannya
        if (!normalized.startsWith('.')) {
            const dotted = '.' + normalized;
            if (this.tools.has(dotted)) {
                return this.tools.get(dotted) || null;
            }
            if (this.aliases.has(dotted)) {
                const name = this.aliases.get(dotted)!;
                return this.tools.get(name) || null;
            }
        }

        // 3. Jika input diawali titik, coba cari tanpa titik
        if (normalized.startsWith('.')) {
            const undotted = normalized.slice(1);
            if (this.tools.has(undotted)) {
                return this.tools.get(undotted) || null;
            }
            if (this.aliases.has(undotted)) {
                const name = this.aliases.get(undotted)!;
                return this.tools.get(name) || null;
            }
        }

        return null;
    }

    isOwnerOnly(nameOrAlias: string): boolean {
        const tool = this.getTool(nameOrAlias);
        return tool?.definition?.owner === true;
    }

    getGroqTools(): Array<{ type: string; function: any }> {
        const groqTools: Array<{ type: string; function: any }> = [];
        for (const toolModule of this.tools.values()) {
            groqTools.push({
                type: 'function',
                function: toolModule.definition
            });
        }
        return groqTools;
    }

    async execute(nameOrAlias: string, args: Record<string, any>, ctx: ToolContext): Promise<any> {
        const tool = this.getTool(nameOrAlias);
        if (!tool) throw new Error(`Tool not found: ${nameOrAlias}`);
        return await tool.execute(args, ctx);
    }
}

const toolsHandler = new ToolsHandler();
await toolsHandler.loadTools();
export default toolsHandler;
