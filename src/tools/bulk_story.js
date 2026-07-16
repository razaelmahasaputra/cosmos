import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { exec } from 'child_process';
import { promisify } from 'util';
import crypto from 'crypto';
import os from 'os';
import { jidNormalizedUser } from '@whiskeysockets/baileys';

const execPromise = promisify(exec);

// Deteksi path FFmpeg secara dinamis
let ffmpegStaticPath = null;
try {
    const ffmpegStatic = await import('ffmpeg-static');
    ffmpegStaticPath = ffmpegStatic.default || ffmpegStatic;
} catch {
    // Platform Android / Termux
}

async function getFFmpegPath() {
    if (ffmpegStaticPath) {
        try {
            await execPromise(`"${ffmpegStaticPath}" -version`);
            return ffmpegStaticPath;
        } catch {
            ffmpegStaticPath = null;
        }
    }
    try {
        await execPromise('ffmpeg -version');
        return 'ffmpeg';
    } catch {
        const termuxPath = '/data/data/com.termux/files/usr/bin/ffmpeg';
        try {
            await execPromise(`"${termuxPath}" -version`);
            return termuxPath;
        } catch {
            return null;
        }
    }
}

async function generateImageThumbnail(imagePath) {
    try {
        const buffer = fs.readFileSync(imagePath);
        return await sharp(buffer).resize(96, 96, { fit: 'cover' }).jpeg({ quality: 50 }).toBuffer();
    } catch (err) {
        console.error('[Bulk Story] Gagal membuat thumbnail gambar:', err);
        return undefined;
    }
}

async function generateVideoThumbnail(videoPath, ffmpegCmd) {
    if (!ffmpegCmd) return undefined;
    const tempDir = os.tmpdir();
    const outputPath = path.join(tempDir, `temp_thumb_${crypto.randomUUID()}.jpg`);

    try {
        const command = `"${ffmpegCmd}" -y -ss 00:00:01 -i "${videoPath}" -vframes 1 -q:v 5 "${outputPath}"`;
        await execPromise(command);

        if (fs.existsSync(outputPath)) {
            const buffer = fs.readFileSync(outputPath);
            try {
                fs.unlinkSync(outputPath);
            } catch (e) {
                console.warn('[Bulk Story] Gagal menghapus file temp:', e.message);
            }

            return await sharp(buffer).resize(96, 96, { fit: 'cover' }).jpeg({ quality: 50 }).toBuffer();
        }
    } catch (err) {
        console.error('[Bulk Story] Gagal membuat thumbnail video:', err);
        try {
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        } catch (e) {
            console.warn('[Bulk Story] Gagal menghapus file temp:', e.message);
        }
    }
    return undefined;
}

export const definition = {
    name: 'bulk_story',
    aliases: ['.bulkstory', '.bsy', '.bstory', '.bulkstatus'],
    description: 'Mengunggah gambar atau video secara massal ke Status/Story WhatsApp.',
    parameters: {
        type: 'object',
        properties: {
            argsStr: {
                type: 'string',
                description: 'Format: [targetFolder]'
            }
        },
        required: []
    }
};

async function getStatusJidList(sock, ctx) {
    const jids = new Set();

    // Log detail user untuk debugging identifikasi JID/LID
    console.log('[Bulk Story] Debug sock.user:', JSON.stringify(sock.user));
    console.log('[Bulk Story] Debug ctx.msg.key:', JSON.stringify(ctx.msg?.key));

    // 1. Tambahkan JID reguler diri sendiri
    if (sock.user?.id) {
        jids.add(jidNormalizedUser(sock.user.id));
    }

    // 2. Tambahkan LID diri sendiri (sangat krusial untuk sinkronisasi status di akun ber-LID)
    if (sock.user?.lid) {
        jids.add(jidNormalizedUser(sock.user.lid));
    }

    // 3. Tambahkan JID/LID pengirim perintah
    if (ctx.jid) {
        jids.add(jidNormalizedUser(ctx.jid));
    }

    // 4. Tambahkan remoteJid asli dari pesan (bisa berupa LID)
    if (ctx.msg?.key?.remoteJid) {
        jids.add(jidNormalizedUser(ctx.msg.key.remoteJid));
    }

    // 5. Tambahkan remoteJidAlt dari pesan jika tersedia
    if (ctx.msg?.key?.remoteJidAlt) {
        jids.add(jidNormalizedUser(ctx.msg.key.remoteJidAlt));
    }

    // 6. Ambil participant dari grup aktif untuk distribusi status ke kontak
    try {
        const groups = await sock.groupFetchAllParticipating();
        const groupJids = Object.keys(groups);

        // Batasi maksimal 5 grup saja untuk efisiensi
        const selectedGroupJids = groupJids.slice(0, 5);
        for (const gJid of selectedGroupJids) {
            const participants = groups[gJid].participants || [];
            for (const p of participants) {
                if (p.id) {
                    jids.add(jidNormalizedUser(p.id));
                }
                if (p.lid) {
                    jids.add(jidNormalizedUser(p.lid));
                }
                // Batasi total agar tidak terlalu banyak (maksimal 200)
                if (jids.size >= 200) break;
            }
            if (jids.size >= 200) break;
        }
    } catch (err) {
        console.error('[Bulk Story] Gagal mengambil participant grup untuk statusJidList:', err);
    }

    const finalJids = Array.from(jids);
    console.log('[Bulk Story] Target statusJidList:', JSON.stringify(finalJids));
    return finalJids;
}

export async function execute(args, ctx) {
    const argsStr = args.argsStr || '';
    const folderName = argsStr.trim() || 'story';

    // Mendukung folder absolut (local storage) maupun folder relatif di dalam direktori bot
    let resolvedPath;
    if (path.isAbsolute(folderName)) {
        resolvedPath = folderName;
    } else {
        resolvedPath = path.resolve(process.cwd(), folderName);
    }

    if (!fs.existsSync(resolvedPath)) {
        // Jika folder relatif tidak ada, kita buatkan
        if (!path.isAbsolute(folderName)) {
            try {
                fs.mkdirSync(resolvedPath, { recursive: true });
                return `Folder "${folderName}" tidak ditemukan. Folder baru telah dibuat di direktori bot. Silakan letakkan 3 hingga 5 file gambar/video di dalamnya dan jalankan kembali perintah ini.`;
            } catch {
                return `Gagal: Folder "${folderName}" tidak ditemukan dan tidak dapat dibuat.`;
            }
        }
        return `Gagal: Folder absolut "${folderName}" tidak ditemukan di local storage.`;
    }

    // Membaca file di folder
    let files;
    try {
        files = fs.readdirSync(resolvedPath);
    } catch (err) {
        return `Gagal membaca folder: ${err.message}`;
    }

    const supportedExtensions = ['.png', '.jpg', '.jpeg', '.mp4'];
    const mediaFiles = files.filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return supportedExtensions.includes(ext);
    });

    const totalMedia = mediaFiles.length;

    // Batasan jumlah file: minimal 3 dan maksimal 5
    if (totalMedia < 3 || totalMedia > 5) {
        return `Gagal: Jumlah file media di dalam folder harus antara 3 hingga 5 file.\nSaat ini ditemukan: ${totalMedia} file yang didukung (${supportedExtensions.join(', ')}).`;
    }

    // Memeriksa batasan ukuran file (Maksimal Video 50MB, Gambar 10MB)
    const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB
    const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
    const oversizedFiles = [];

    for (const fileName of mediaFiles) {
        const filePath = path.join(resolvedPath, fileName);
        const stat = fs.statSync(filePath);
        const ext = path.extname(fileName).toLowerCase();

        if (ext === '.mp4' && stat.size > MAX_VIDEO_SIZE) {
            oversizedFiles.push(`${fileName} (${(stat.size / (1024 * 1024)).toFixed(1)}MB > 50MB)`);
        } else if (['.jpg', '.jpeg', '.png'].includes(ext) && stat.size > MAX_IMAGE_SIZE) {
            oversizedFiles.push(`${fileName} (${(stat.size / (1024 * 1024)).toFixed(1)}MB > 10MB)`);
        }
    }

    if (oversizedFiles.length > 0) {
        return `Gagal: Ditemukan file yang melebihi batas ukuran:\n` + oversizedFiles.map((f) => `- ${f}`).join('\n');
    }

    // Membaca metadata / caption jika ada
    let captionsMap = {};
    const captionsJsonPath = path.join(resolvedPath, 'captions.json');
    const metadataJsonPath = path.join(resolvedPath, 'metadata.json');

    if (fs.existsSync(captionsJsonPath)) {
        try {
            captionsMap = JSON.parse(fs.readFileSync(captionsJsonPath, 'utf-8'));
        } catch (err) {
            console.error('Gagal membaca captions.json:', err);
        }
    } else if (fs.existsSync(metadataJsonPath)) {
        try {
            captionsMap = JSON.parse(fs.readFileSync(metadataJsonPath, 'utf-8'));
        } catch (err) {
            console.error('Gagal membaca metadata.json:', err);
        }
    }

    // Kumpulkan statusJidList
    const statusInitMsg = await ctx.sock.sendMessage(ctx.jid, {
        text: `⏳ Menyiapkan daftar kontak penerima status WhatsApp...`
    });

    const jidList = await getStatusJidList(ctx.sock, ctx);
    if (jidList.length === 0) {
        await ctx.sock.sendMessage(ctx.jid, {
            text: `❌ Gagal: Tidak dapat menemukan kontak penerima status WhatsApp.`,
            edit: statusInitMsg.key
        });
        return;
    }

    // Kirim status awal dengan progress bar
    await ctx.sock.sendMessage(ctx.jid, {
        text: `🚀 Memulai proses unggah massal...\n[░░░░░] 0%\n\n• Menunggu antrean media pertama...`,
        edit: statusInitMsg.key
    });

    let successCount = 0;
    let failCount = 0;
    const errors = [];

    // Deteksi path FFmpeg sebelum loop dimulai
    const ffmpegCmd = await getFFmpegPath();

    // Tampilkan log inisiasi di console
    console.log(`\n[Bulk Story] Memulai proses upload massal (${totalMedia} file)`);

    for (let i = 0; i < mediaFiles.length; i++) {
        const fileName = mediaFiles[i];
        const filePath = path.join(resolvedPath, fileName);
        const ext = path.extname(fileName).toLowerCase();

        let fileSizeMB = '0.00';
        try {
            const stat = fs.statSync(filePath);
            fileSizeMB = (stat.size / (1024 * 1024)).toFixed(2);
        } catch (err) {
            console.error(`[Bulk Story] Gagal membaca stat file ${fileName}:`, err);
        }

        // Tampilkan status pemrosesan file saat ini di WhatsApp
        const progressPercent = Math.round((i / totalMedia) * 100);
        const filledBars = Math.round((i / totalMedia) * 5);
        const emptyBars = 5 - filledBars;
        const progressBar = '▓'.repeat(filledBars) + '░'.repeat(emptyBars);

        await ctx.sock.sendMessage(ctx.jid, {
            text: `⏳ Sedang mengunggah (${i + 1}/${totalMedia})\n[${progressBar}] ${progressPercent}%\n\n• File: ${fileName} (${fileSizeMB} MB)\n• Status: Mengunggah media ke WhatsApp...`,
            edit: statusInitMsg.key
        });

        // Console log progress bar sebelum upload
        const consoleBarBefore = '='.repeat(i) + ' '.repeat(totalMedia - i);
        console.log(
            `[Bulk Story] [${consoleBarBefore}] ${progressPercent}% | Uploading: ${fileName} (${fileSizeMB} MB)...`
        );

        try {
            // Cari caption
            let caption = undefined;
            if (captionsMap[fileName]) {
                caption = captionsMap[fileName];
            } else {
                const baseName = path.basename(fileName, ext);
                const txtPath = path.join(resolvedPath, `${baseName}.txt`);
                if (fs.existsSync(txtPath)) {
                    try {
                        caption = fs.readFileSync(txtPath, 'utf-8').trim();
                    } catch (err) {
                        console.error(`Gagal membaca file caption pendamping ${baseName}.txt:`, err);
                    }
                }
            }

            // Membuat thumbnail untuk gambar atau video
            let thumbnail = undefined;
            if (ext === '.mp4') {
                thumbnail = await generateVideoThumbnail(filePath, ffmpegCmd);
            } else if (['.jpg', '.jpeg', '.png'].includes(ext)) {
                thumbnail = await generateImageThumbnail(filePath);
            }

            const mediaType = ext === '.mp4' ? 'video' : 'image';
            const messageContent = {};

            messageContent[mediaType] = { url: filePath };
            if (caption) {
                messageContent.caption = caption;
            }
            if (thumbnail) {
                messageContent.jpegThumbnail = thumbnail;
            }

            // Kirim status
            await ctx.sock.sendMessage('status@broadcast', messageContent, {
                statusJidList: jidList,
                broadcast: true
            });

            successCount++;
        } catch (err) {
            failCount++;
            errors.push(`${fileName}: ${err.message}`);
            console.error(`[Bulk Story] Gagal mengunggah status ${fileName}:`, err);
        }

        // Update progress bar setelah file selesai diproses
        const currentPercent = Math.round(((i + 1) / totalMedia) * 100);
        const currentFilled = Math.round(((i + 1) / totalMedia) * 5);
        const currentEmpty = 5 - currentFilled;
        const currentBar = '▓'.repeat(currentFilled) + '░'.repeat(currentEmpty);

        await ctx.sock.sendMessage(ctx.jid, {
            text: `⏳ Progress unggah (${i + 1}/${totalMedia})\n[${currentBar}] ${currentPercent}%\n\n• Berhasil: ${successCount}\n• Gagal: ${failCount}`,
            edit: statusInitMsg.key
        });

        // Console log progress bar setelah upload selesai
        const consoleBarAfter = '='.repeat(i + 1) + ' '.repeat(totalMedia - (i + 1));
        console.log(`[Bulk Story] [${consoleBarAfter}] ${currentPercent}% | Finished: ${fileName} (${fileSizeMB} MB)`);

        // Delay 15 detik untuk media besar agar tidak rate limit / gagal sync
        if (i < mediaFiles.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 15000));
        }
    }

    let responseText = `✅ Selesai memproses bulk upload status!\n\n• Berhasil: ${successCount}\n• Gagal: ${failCount}`;
    if (errors.length > 0) {
        responseText += `\n\nDetail Error:\n` + errors.map((e) => `- ${e}`).join('\n');
    }

    console.log(`[Bulk Story] Selesai: Berhasil ${successCount}, Gagal ${failCount}\n`);

    await ctx.sock.sendMessage(ctx.jid, {
        text: responseText,
        edit: statusInitMsg.key
    });

    return;
}
