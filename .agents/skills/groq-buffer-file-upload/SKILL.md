---
name: groq-buffer-file-upload
description: Panduan mengupload binary buffer ke API transkripsi Groq Whisper di Node.js menggunakan helper toFile.
---

# Groq Whisper Buffer Upload Guideline

## Masalah

Menggunakan objek `new File` bawaan Node.js untuk membungkus `Buffer` saat mengupload ke Groq Whisper API dapat menyebabkan kegagalan diam-diam (silent failure) atau error jika platform hosting menggunakan versi Node.js yang lebih lama (seperti Node 18) yang belum mendukung atau memiliki representasi `File` global yang kompatibel dengan SDK.

## Solusi / Skill

Gunakan helper `toFile` bawaan dari `groq-sdk` (atau `openai/uploads`) untuk mengonversi binary Buffer secara aman tanpa menyimpan file sementara ke disk.

```javascript
import { Groq, toFile } from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Di dalam fungsi asinkron
const file = await toFile(buffer, 'audio.ogg', { type: 'audio/ogg' });
const transcription = await groq.audio.transcriptions.create({
    file,
    model: 'whisper-large-v3-turbo'
});
```
