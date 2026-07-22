import { stopLyrics } from '#/utils/lyricsPlayer.js';

export const definition = {
    name: 'stoplyrics',
    aliases: ['.stoplyrics', '.slyrics'],
    description: 'Menghentikan pemutaran lirik yang sedang berlangsung di chat ini.',
    parameters: {
        type: 'object',
        properties: {},
        required: []
    }
};

export async function execute(_, ctx) {
    try {
        const result = await stopLyrics(ctx.jid, ctx.sock);
        return result;
    } catch (err) {
        console.error('Error in stoplyrics tool:', err);
        return 'Gagal: Terjadi kesalahan saat menghentikan pemutaran lirik.';
    }
}
