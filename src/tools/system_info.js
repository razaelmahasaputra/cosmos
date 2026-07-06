import os from 'os';

export const definition = {
    name: 'system_info',
    aliases: ['.ping', '.stats', '.status', '.speed'],
    description: 'Menampilkan informasi spesifikasi server, bot, dan latensi.',
    parameters: {
        type: 'object',
        properties: {},
        required: []
    }
};

function formatBytes(bytes) {
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(2)} GB`;
}

function formatUptime(seconds) {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${d > 0 ? `${d}d ` : ''}${h > 0 ? `${h}h ` : ''}${m > 0 ? `${m}m ` : ''}${s}s`;
}

export async function execute(_, ctx) {
    const systemUptime = formatUptime(os.uptime());
    const botUptime = formatUptime(process.uptime());
    const cpus = os.cpus();
    const cpuModel = cpus && cpus[0] ? cpus[0].model.trim() : 'Tidak diketahui';
    const cpuArch = os.arch();
    const totalMem = formatBytes(os.totalmem());
    const freeMem = formatBytes(os.freemem());
    const usedMem = formatBytes(os.totalmem() - os.freemem());

    let latencyStr = 'Tidak diketahui';
    if (ctx && ctx.msg && ctx.msg.messageTimestamp) {
        const timestampVal =
            typeof ctx.msg.messageTimestamp === 'object' && ctx.msg.messageTimestamp !== null
                ? (ctx.msg.messageTimestamp.low ?? ctx.msg.messageTimestamp.unsigned ?? 0)
                : ctx.msg.messageTimestamp;
        if (timestampVal > 0) {
            const msgTimeMs = timestampVal * 1000;
            const diff = Date.now() - msgTimeMs;
            latencyStr = `${diff} ms`;
        }
    }

    return (
        `*⚡ STATUS BOT & SERVER*\n\n` +
        `• *Latensi:* ${latencyStr}\n` +
        `• *OS:* ${os.type()} (${os.release()})\n` +
        `• *CPU:* ${cpuModel} (${cpuArch})\n` +
        `• *RAM:* ${usedMem} / ${totalMem} (Sisa: ${freeMem})\n` +
        `• *Uptime Server:* ${systemUptime}\n` +
        `• *Uptime Bot:* ${botUptime}\n` +
        `• *Node.js:* ${process.version}`
    );
}
