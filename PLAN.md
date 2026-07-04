# Plan: WhatsApp AI Bot dengan Multi-Tools

## 1. Tech Stack

- **Runtime**: Node.js (JavaScript)
- **WhatsApp Library**: `@whiskeysockets/baileys` (Koneksi WA Web tanpa API resmi)
- **AI Engine**: Groq API (menggunakan model yang mendukung tool calling, via SDK resmi/LangChain)
- **Database**: Supabase (Untuk menyimpan sesi chat dan data pengguna)

## 1.5. Environment Variables

- `BOT_PHONE_NUMBER`: Nomor bot/owner (digunakan untuk login _pairing code_ dan validasi akses command admin).
- `GROQ_API_KEY`: API Key Groq.
- `SUPABASE_URL` & `SUPABASE_KEY`: Kredensial database.
- `OPENWEATHER_API_KEY`, `TAVILY_API_KEY`: API keys untuk tools.

## 2. Struktur Proyek

```text
/src
  ├── index.js        # Entry point, setup Baileys & koneksi
  ├── ai.js           # Konfigurasi AI agent dan prompt
  ├── tools/          # Folder untuk masing-masing tool (search, cuaca, dll)
  ├── handlers/       # Handler pesan masuk
  └── db.js           # Koneksi database untuk histori percakapan
```

## 3. Fase Pengembangan

### Fase 1: Setup Dasar (Bot WA)

1. Inisialisasi proyek Node.js.
2. Setup koneksi `@whiskeysockets/baileys` dengan `useMultiFileAuthState` agar sesi login persisten.
    - **Gunakan Pairing Code** (bukan QR Code) karena ASCII QR sering tidak terbaca dengan baik di console web Pterodactyl.
    - _(Catatan: Baileys unofficial, ada risiko nomor di-banned WA)._
3. Implementasi **Rate Limiting & Queue Concurrency** per nomor pengirim sejak awal untuk mencegah race condition (riwayat chat tumpang tindih) dan pembengkakan biaya API token.
4. Buat handler dasar untuk menerima dan membalas pesan teks.

### Fase 2: Integrasi AI, Sesi, & System Prompt

1. Integrasikan SDK AI (Groq API).
2. Setup manajemen histori obrolan per nomor pengirim (`remoteJid`) agar AI memiliki konteks percakapan.
3. **Modular System Prompt & Skills**: Pisahkan system prompt ke folder eksternal (misal: `src/prompt/`). Terapkan arsitektur loading bertingkat:
    - `core.md` (Identitas utama bot + Deklarasi "kesadaran diri" bahwa AI memiliki kumpulan tool/skill).
    - `skills/index.md` (Manifest daftar skill. Memastikan AI selalu _sadar_ tool apa saja yang ia miliki di setiap request).
    - `skills/<nama_skill>/SKILL.md` (Berisi panduan/cara penggunaan spesifik tiap tool, format parameter, dan batasan. Di-load secara dinamis saat _trigger_ cocok).
4. Sambungkan handler pesan Baileys ke fungsi AI dengan injeksi prompt modular.

### Fase 3: Pembuatan Multi-Tools

Gunakan sistem _Dynamic Function Calling_ (Tools). Tools akan diregistrasi secara dinamis dengan membaca semua file dalam folder `tools/` (auto-loading), sehingga penambahan tool baru di masa depan hanya perlu menambah file baru tanpa mengubah kode utama bot.
Daftar tools utama yang akan diimplementasikan:

#### 1. `downloader` (URL to WhatsApp Media)

Mengunduh video/konten dari URL mentah. Termasuk proteksi SSRF (blokir IP privat, hanya HTTPS), streaming agar hemat RAM, dan error log aman.

```javascript
import { isIP } from 'net';
async function execute({ url }, ctx) {
    try {
        const parsedUrl = new URL(url);
        // Validasi SSRF dasar (idealnya resolve DNS & cek range IP privat/localhost)
        if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') return 'URL tidak valid.';
        if (isIP(parsedUrl.hostname)) return 'Akses ke IP address langsung diblokir demi keamanan.';

        // Gunakan streaming untuk mencegah 50MB dimuat ke RAM
        const res = await axios({ method: 'get', url: url, responseType: 'stream' });
        const size = parseInt(res.headers['content-length'] || '0', 10);
        if (size > 50 * 1024 * 1024) return 'Gagal: File melebihi batas 50MB.';

        // Fallback jika mime undefined dari server target
        const mime = res.headers['content-type'] || 'application/octet-stream';

        // Auto-detect mimetype untuk sendMessage via stream
        const msgPayload = mime.startsWith('video/')
            ? { video: { stream: res.data } }
            : mime.startsWith('image/')
              ? { image: { stream: res.data } }
              : { document: { stream: res.data }, mimetype: mime, fileName: 'downloaded_file' };

        await ctx.socket.sendMessage(ctx.jid, msgPayload, { quoted: ctx.msg });
        return 'Berhasil mengirimkan file ke user.';
    } catch (error) {
        console.error('[Downloader Tool Error]', error); // Log real error di server
        return 'Terjadi kesalahan saat mengunduh file. Pastikan URL valid dan dapat diakses.'; // Pesan generic ke user (cegah leak)
    }
}
```

#### 2. `sticker_maker` (Image to Sticker)

Auto-crop 1:1 dan konversi gambar ke sticker (WebP) menggunakan `sharp`.

```javascript
import sharp from 'sharp';
async function execute(_, ctx) {
    if (!ctx.media) return 'Gagal: Tidak ada gambar yang dilampirkan.';

    const webpBuffer = await sharp(ctx.media)
        .resize(512, 512, { fit: 'cover' }) // Crop 1:1
        .webp({ quality: 80 })
        .toBuffer();

    await ctx.socket.sendMessage(ctx.jid, { sticker: webpBuffer }, { quoted: ctx.msg });
    return 'Sticker berhasil dibuat dan dikirim.';
}
```

#### 3. `sticker_to_image` (Sticker to Image)

Mengkonversi sticker animasi/statis (WebP) kembali menjadi gambar (JPEG).

```javascript
import sharp from 'sharp';
async function execute(_, ctx) {
    if (!ctx.media) return 'Gagal: Tidak ada sticker yang dilampirkan.';

    const imgBuffer = await sharp(ctx.media).jpeg({ quality: 100 }).toBuffer();

    await ctx.socket.sendMessage(ctx.jid, { image: imgBuffer, caption: 'Konversi berhasil' }, { quoted: ctx.msg });
    return 'Berhasil mengkonversi sticker ke gambar.';
}
```

#### 4. `web_search` & `weather`

- **web_search**: Fetch JSON dari Tavily API/Google Search untuk mencari informasi terbaru.
- **weather**: HTTP Get ke OpenWeather API untuk mengetahui kondisi cuaca.

### Fase 4: Keamanan Lanjutan & Anti-Ban WA

1. **Filter Pesan & Mode Self-Bot:**
    - Bot dikonfigurasi sebagai _self-bot_ (nomor bot sekaligus nomor owner). Bot **wajib** mendengarkan pesan dari dirinya sendiri (`key.fromMe === true`) untuk mengeksekusi AI query dan tools.
    - Hak akses command Admin (misal `.addgroup`) **terkunci secara eksklusif** hanya untuk `BOT_PHONE_NUMBER` yang diset di `.env`.
    - Abaikan _update status_ (story) dan _broadcast message_.
2. **Proteksi SSRF:** Validasi URL ketat pada tool _downloader_, blokir IP privat/localhost.
3. **Routing & Whitelist Grup:**
    - Bot mendukung obrolan grup, tapi **terbatas** hanya untuk Group ID yang terdaftar di whitelist database.
    - **Filter Trigger:** Bot tidak mendengarkan/memproses setiap pesan. Bot hanya bereaksi pada _AI query_ (misal pesan di-tag/dimulai dengan nama bot) atau pada _command_ spesifik (misal `.sticker`). Ini mencegah pemborosan token dan spam di grup.
4. **Strategi Mitigasi Anti-Ban:**
    - Gunakan nomor bot lama/aktif (jangan gunakan nomor pribadi atau nomor baru diregistrasi hari ini).
    - Terapkan _delay_ (2-5 detik) dan kirim status `composing` (mengetik) sebelum membalas agar menyerupai perilaku manusia.
    - Gunakan sistem _queue_ untuk memproses rentetan pesan secara bertahap, bukan instan sekaligus.
    - Bot bersifat murni reaktif (hanya membalas chat masuk), dilarang mengirim broadcast massal/proaktif.

### Fase 5: Deployment (Pterodactyl Panel)

1. **Pre-Flight Checks**:
    - Pastikan firewall Pterodactyl tidak memblokir _outbound_ WebSocket ke server WhatsApp.
    - Pastikan _container_ egg memiliki akses internet saat `npm install` (dibutuhkan untuk mengunduh prebuilt binary `sharp`).
    - Waspada risiko _shared IP reputation_ (IP server diblokir jika user lain di _node_ yang sama melanggar ToS WA).
2. **Setup Egg Node.js**: Gunakan egg Node.js standar. Set _startup command_ langsung ke `node src/index.js` atau `npm start`. Tidak perlu PM2 atau Docker Compose, karena Pterodactyl (Wings) sudah otomatis menangani isolasi _container_ dan _auto-restart_.
3. **Persistensi Data**: Folder `useMultiFileAuthState` aman persisten di `/home/container/` secara default. Namun, siapkan script _backup_ sesi ke Supabase untuk berjaga-jaga jika _egg_ atau server di-_reinstall_.
