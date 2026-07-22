import { playLyrics } from '#/utils/lyricsPlayer.js';
import { ToolDefinition, ToolContext } from './types.js';

export const definition: ToolDefinition = {
    name: 'playlyrics',
    aliases: ['.playlyrics', '.plyrics'],
    description: 'Memulai pemutaran lirik otomatis untuk file lirik (.lrc atau .txt) yang berada di folder lyrics/.',
    parameters: {
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: "Format: 'nama file' | [speedMultiplier]"
            }
        },
        required: ['query']
    }
};

export async function execute(args: Record<string, any>, ctx: ToolContext): Promise<string> {
    const query = args.query ? String(args.query).trim() : '';
    if (!query) {
        return "Gagal: Format perintah salah. Gunakan: `.playlyrics 'nama file' | [multiplier]`";
    }

    let songName: string;
    let multiplierStr = '';

    // 1. Check if pipe separator exists
    if (query.includes('|')) {
        const parts = query.split('|');
        const filePart = parts[0].trim();
        multiplierStr = parts[1].trim();

        // Extract filename from quotes if present
        const match = filePart.match(/^(['"])(.*?)\1$/);
        if (match) {
            songName = match[2].trim();
        } else {
            songName = filePart;
        }
    } else {
        // If no '|', check if the whole query is quoted
        const match = query.match(/^(['"])(.*?)\1$/);
        if (match) {
            songName = match[2].trim();
        } else {
            songName = query;
        }
    }

    let speedMultiplier = 2; // Default multiplier is 2
    if (multiplierStr) {
        const val = parseFloat(multiplierStr);
        if (!isNaN(val) && val > 0) {
            speedMultiplier = val;
        } else {
            return 'Gagal: Multiplier harus berupa angka positif.';
        }
    }

    try {
        const result = await playLyrics(ctx.jid, ctx.sock, songName, speedMultiplier);
        return result;
    } catch (err) {
        console.error('Error in playlyrics tool:', err);
        return 'Gagal: Terjadi kesalahan saat memproses pemutaran lirik.';
    }
}
