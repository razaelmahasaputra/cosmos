import axios from 'axios';
import { isIP, isIPv4, isIPv6 } from 'net';
import dns from 'dns';

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

function isPrivateIP(ip) {
    if (isIPv4(ip)) {
        const parts = ip.split('.').map(Number);
        if (parts.length !== 4 || parts.some(isNaN)) return true;
        const [a, b] = parts;
        if (a === 127) return true; // Loopback
        if (a === 10) return true; // Class A Private
        if (a === 172 && b >= 16 && b <= 31) return true; // Class B Private
        if (a === 192 && b === 168) return true; // Class C Private
        if (a === 169 && b === 254) return true; // Link-local
        if (a === 100 && b >= 64 && b <= 127) return true; // Carrier-grade NAT
        if (a === 0) return true; // Local network
        if (ip === '255.255.255.255') return true;
        return false;
    } else if (isIPv6(ip)) {
        const normalized = ip.toLowerCase().trim();
        if (normalized === '::1' || normalized === '::') return true;
        if (
            normalized.startsWith('fe8') ||
            normalized.startsWith('fe9') ||
            normalized.startsWith('fea') ||
            normalized.startsWith('feb')
        ) {
            return true;
        }
        if (normalized.startsWith('fc') || normalized.startsWith('fd')) {
            return true;
        }
        if (normalized.startsWith('::ffff:')) {
            const mapped = normalized.substring(7);
            if (isIPv4(mapped)) {
                return isPrivateIP(mapped);
            }
            const hexParts = mapped.split(':');
            if (hexParts.length === 2) {
                const high = parseInt(hexParts[0], 16);
                const low = parseInt(hexParts[1], 16);
                if (!isNaN(high) && !isNaN(low)) {
                    const a = (high >> 8) & 0xff;
                    const b = high & 0xff;
                    const c = (low >> 8) & 0xff;
                    const d = low & 0xff;
                    return isPrivateIP(`${a}.${b}.${c}.${d}`);
                }
            }
        }
        return false;
    }
    return true;
}

async function resolveHostname(hostname) {
    if (isIP(hostname)) {
        return [hostname];
    }
    try {
        const addresses = await dns.promises.lookup(hostname, { all: true });
        return addresses.map((addr) => addr.address);
    } catch (err) {
        throw new Error(`DNS lookup failed: ${err.message}`, { cause: err });
    }
}

async function safeGet(urlStr, redirectCount = 0) {
    if (redirectCount > 5) {
        throw new Error('Terlalu banyak redirect.');
    }

    const parsedUrl = new URL(urlStr);
    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
        throw new Error('Protokol tidak valid.');
    }

    const ips = await resolveHostname(parsedUrl.hostname);
    for (const ip of ips) {
        if (isPrivateIP(ip)) {
            throw new Error('Akses ke IP privat/lokal diblokir demi keamanan.');
        }
    }

    const res = await axios({
        method: 'get',
        url: urlStr,
        responseType: 'stream',
        maxRedirects: 0,
        validateStatus: (status) => status >= 200 && status < 400
    });

    if (res.status >= 300 && res.status < 400) {
        const location = res.headers.location;
        if (!location) {
            throw new Error('Redirect tanpa lokasi.');
        }
        const absoluteUrl = new URL(location, urlStr).toString();
        return safeGet(absoluteUrl, redirectCount + 1);
    }

    return res;
}

export async function execute({ url }, ctx) {
    try {
        const res = await safeGet(url);

        const limit = 50 * 1024 * 1024; // 50MB
        const size = parseInt(res.headers['content-length'] || '0', 10);
        if (size > limit) return 'Gagal: File melebihi batas 50MB.';

        let downloadedBytes = 0;
        res.data.on('data', (chunk) => {
            downloadedBytes += chunk.length;
            if (downloadedBytes > limit) {
                console.warn('Stream size limit exceeded, destroying stream.');
                res.data.destroy(new Error('File size limit exceeded (50MB).'));
            }
        });

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
        return `Terjadi kesalahan saat mengunduh file: ${error.message}`;
    }
}
