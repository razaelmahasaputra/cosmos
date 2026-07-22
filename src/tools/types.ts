import { WASocket, WAMessage } from '@whiskeysockets/baileys';

export interface ToolDefinition {
    name: string;
    aliases?: string[];
    description: string;
    parameters?: {
        type: string;
        properties?: Record<string, any>;
        required?: string[];
    };
}

export interface ToolContext {
    sock: WASocket;
    msg: WAMessage;
    jid: string;
}

export interface ToolModule {
    definition: ToolDefinition;
    execute: (args: Record<string, any>, ctx: ToolContext) => Promise<string | null | undefined | void>;
}
