---
name: formal-english-output-strings
description: >
    Aturan mutlak untuk memastikan seluruh string bertipe output (pesan ke pengguna, respon bot, deskripsi tool, pesan error, log publik, dan prompt AI) ditulis dalam bahasa Inggris formal (Formal English), bukan Bahasa Indonesia baku.
---

# Formal English Output Strings

## Konteks Kesalahan

Sering kali AI Coding Agent membuat atau menambahkan string bertipe output ke pengguna (seperti balasan bot, deskripsi perintah, pesan error, log status, atau prompt sistem AI) dalam Bahasa Indonesia baku atau tidak baku (misal: `"Gagal: Perintah ini hanya dapat digunakan oleh owner"`).

## Kenapa Salah

1. Standar internasional antarmuka aplikasi dan bot menghendaki konsistensi bahasa menggunakan **Bahasa Inggris Formal** (_Formal English_).
2. Campur aduk bahasa pada output bot membuat antarmuka terlihat tidak profesional dan membingungkan pengguna internasional atau sistem integrasi eksternal.

## Yang Benar

Seluruh string bertipe output pengguna, respon pesan, deskripsi tool/command, pesan kesalahan, dan prompt AI wajib ditulis dalam **Bahasa Inggris Formal** yang jernih dan profesional.

### Contoh Salah:

```typescript
export const definition: ToolDefinition = {
    name: 'sample_tool',
    aliases: ['.sample'],
    description: 'Menampilkan informasi status server bot.',
    parameters: { type: 'object', properties: {}, required: [] }
};

export async function execute(_args: Record<string, any>, ctx: ToolContext): Promise<string> {
    if (!ctx.msg) {
        return 'Gagal: Pesan tidak ditemukan.';
    }
    return 'Berhasil memproses permintaan Anda.';
}
```

### Contoh Benar:

```typescript
export const definition: ToolDefinition = {
    name: 'sample_tool',
    aliases: ['.sample'],
    description: 'Displays the bot server status information.',
    parameters: { type: 'object', properties: {}, required: [] }
};

export async function execute(_args: Record<string, any>, ctx: ToolContext): Promise<string> {
    if (!ctx.msg) {
        return 'Failed: Message not found.';
    }
    return 'Successfully processed your request.';
}
```

## Aturan Baku

- **SELALU** gunakan Bahasa Inggris Formal untuk:
    1. Teks respon balasan bot yang akan terkirim ke pengguna WhatsApp (`sendMessage`, return value tool `execute`).
    2. Deskripsi perintah dan deskripsi parameter pada `ToolDefinition` (`description`, `properties.<key>.description`).
    3. Pesan error dan pemberitahuan status sistem (`Failed: ...`, `Error: ...`).
    4. System prompt untuk LLM / AI API (seperti Groq SDK prompt).
- **DILARANG KERAS** menggunakan Bahasa Indonesia baku atau tidak baku untuk string output kode di dalam proyek.
