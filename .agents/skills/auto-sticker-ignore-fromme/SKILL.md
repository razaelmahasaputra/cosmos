---
name: auto-sticker-ignore-fromme
description: Panduan mencegah fitur auto-sticker (atau fitur reaktif lainnya) terpancing oleh pesan media dari bot itu sendiri (dari msg.key.fromMe).
---

# Mencegah Auto-Sticker Terpancing Pesan Bot Sendiri

Saat bot memproses pesan masuk di `messages.upsert`, pesan yang dikirim oleh bot itu sendiri (ditandai dengan `msg.key.fromMe === true`) juga akan masuk ke dalam event stream. 

## Kesalahan Umum
Jika sebuah fitur (seperti *auto sticker* yang merespons media dengan stiker) tidak memeriksa `msg.key.fromMe`, maka setiap kali bot mengirimkan video atau gambar hasil dari perintah lain (misal: perintah download video yt-dlp), fitur *auto sticker* akan ikut terpicu. Hal ini menyebabkan loop atau error yang tidak diinginkan (seperti pesan error ukuran file melebihi batas stiker).

## Solusi
Namun, **JANGAN memblokir semua pesan `msg.key.fromMe`** karena pemilik bot yang menggunakan nomor yang sama tetap ingin menggunakan fitur tersebut secara manual.

Gunakan heuristik yang membedakan pesan otomatis bot dengan pesan manual pemilik. Biasanya, pesan otomatis bot (terutama yang menyertakan media) memiliki caption yang diawali dengan emoji formal seperti `✅`, `⏳`, atau `❌`.

Contoh perbaikan pada `message.ts`:

```typescript
// SEBELUM:
if (isAutoStickerEnabled(jid) && hasDirectMedia(msg.message)) { ... }

// SESUDAH:
// Ignore programmatic bot responses (which usually start with ✅, ⏳, or ❌) to prevent loops, but allow owner's manual media
const isBotResponse = msg.key.fromMe && text && (text.startsWith('✅') || text.startsWith('⏳') || text.startsWith('❌'));
if (!isBotResponse && isAutoStickerEnabled(jid) && hasDirectMedia(msg.message)) { ... }
```
