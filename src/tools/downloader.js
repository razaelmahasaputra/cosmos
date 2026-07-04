import axios from 'axios';
import { isIP } from 'net';

export const definition = {
    name: 'downloader',
    description: 'Mengunduh video/konten dari URL mentah dan mengirimkannya ke pengguna.',
    parameters: {
        type: 'object',
        properties: {
            url: {
                type: 'string',
                description: 'URL file yang akan diunduh.'
            }
        },
        required: ['url']
    }
};

export async function execute({ url }, ctx) {
    try {
        const parsedUrl = new URL(url);
        if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') return 'URL tidak valid.';
        if (isIP(parsedUrl.hostname)) return 'Akses ke IP address langsung diblokir demi keamanan.';

        const res = await axios({ method: 'get', url: url, responseType: 'stream' });
        const size = parseInt(res.headers['content-length'] || '0', 10);
        if (size > 50 * 1024 * 1024) return 'Gagal: File melebihi batas 50MB.';

        const mime = res.headers['content-type'] || 'application/octet-stream';

        const msgPayload = mime.startsWith('video/')
            ? { video: { stream: res.data } }
            : mime.startsWith('image/')
              ? { image: { stream: res.data } }
              : { document: { stream: res.data }, mimetype: mime, fileName: 'downloaded_file' };

        await ctx.sock.sendMessage(ctx.jid, msgPayload, { quoted: ctx.msg });
        return 'Berhasil mengirimkan file ke user.';
    } catch (error) {
        console.error('[Downloader Tool Error]', error);
        return 'Terjadi kesalahan saat mengunduh file. Pastikan URL valid dan dapat diakses.';
    }
}
