---
name: deterministic-tool-calling-temp
description: >
  Aturan untuk selalu mengatur nilai temperature rendah (misalnya 0 atau 0.1) saat menggunakan tool calling (tool_choice="auto") pada LLM agar tidak berhalusinasi.
---

# Deterministic Tool Calling Temperature

## Konteks Kesalahan
AI mengabaikan daftar tools yang tersedia (seperti `weather` atau `web_search`) dan malah menjawab dengan berhalusinasi meskipun `tool_choice: "auto"` sudah diatur.

## Apa yang Salah
```javascript
const response = await groq.chat.completions.create({
    model: 'model-name',
    messages: messages,
    tools: tools,
    tool_choice: 'auto'
    // temperature tidak diset (default tinggi)
});
```

## Kenapa Salah
Beberapa model tidak mendukung tool calling sebaik Llama-3 (misal model eksperimental atau OpenRouter proxy). Selain itu, tanpa `temperature` yang rendah, AI menjadi terlalu "kreatif" dan memilih untuk mengarang jawaban berdasarkan data latihannya sendiri ketimbang mengirim format JSON yang kaku (tool calling).

## Yang Benar
```javascript
const response = await groq.chat.completions.create({
    model: 'model-name',
    messages: messages,
    tools: tools,
    tool_choice: 'auto',
    temperature: 0.1 // Set rendah untuk hasil tool calling yang deterministik
});
```

## Aturan
- **JANGAN** menggunakan temperature tinggi (atau default) jika ingin mengandalkan eksekusi `tools` secara konsisten, terutama untuk model pihak ketiga.
- **SELALU** atur `temperature: 0` atau `0.1` saat menggunakan API dengan kapabilitas Tool Calling.
