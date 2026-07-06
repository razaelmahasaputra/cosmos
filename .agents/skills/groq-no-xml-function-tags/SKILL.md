---
name: groq-no-xml-function-tags
description: >
    Mencegah error 400 Bad Request pada Groq SDK akibat LLM menghasilkan tag XML secara manual untuk function calling. LLM harus diinstruksikan untuk menggunakan Native Function Calling.
---

# Groq: No XML Function Tags

## Konteks Kesalahan

Saat menggunakan Groq SDK untuk pemanggilan alat (tool calling) pada model Llama-3, model sering kali mencoba mencetak tag XML (seperti `<function=weather>`) ke dalam respons teks alih-alih mengeksekusi Native Tool Calling bawaan Groq, yang menyebabkan error API 400.

## Apa yang Salah

```markdown
# Prompt yang kurang tegas

Jika pengguna meminta cuaca, segera panggil fungsi cuaca.
```

## Kenapa Salah

Model Llama terkadang merespons secara harfiah dengan mengetik tag fungsi di teks alih-alih mengirim payload JSON ke sistem di latar belakang. Groq API menolak string yang mengandung format internal tersebut dan memunculkan error `400 Bad Request: Failed to call a function`.

## Yang Benar

```markdown
# Prompt yang tegas

Gunakan Native Function Calling API. DILARANG KERAS mengetik tag XML seperti `<function=...>` secara manual di dalam teks balasan Anda!
```

## Aturan

- **JANGAN** membiarkan prompt yang longgar tanpa pencegahan output XML tag jika bekerja dengan Groq Llama Tool Calling.
- **SELALU** beri penekanan keras pada prompt sistem agar model murni mengembalikan JSON (Native Tool Calling) tanpa membocorkan tag fungsi di teksnya.
