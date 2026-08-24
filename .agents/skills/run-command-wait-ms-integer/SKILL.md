---
name: run-command-wait-ms-integer
description: Aturan untuk memastikan argument WaitMsBeforeAsync pada tool run_command bertipe integer, bukan string.
---

# Aturan Penggunaan Tool run_command (WaitMsBeforeAsync)

## Masalah yang Ditemukan

Saat menggunakan tool `run_command`, pengiriman argument `WaitMsBeforeAsync` dalam bentuk string (misalnya `"2000"`) akan menyebabkan error JSON unmarshal:
`cannot unmarshal string into Go struct field RunCommandArgs.WaitMsBeforeAsync of type uint64`.

## Solusi / Aturan Baku

Selalu pastikan bahwa nilai `WaitMsBeforeAsync` dikirimkan secara eksplisit sebagai tipe **Integer / Number** murni tanpa tanda kutip (misalnya `2000` bukan `"2000"`).

**Contoh Salah (Bikin Error):**

```json
{
    "CommandLine": "pnpm build",
    "Cwd": "/home/admin/waf",
    "WaitMsBeforeAsync": "2000" // ERROR
}
```

**Contoh Benar:**

```json
{
    "CommandLine": "pnpm build",
    "Cwd": "/home/admin/waf",
    "WaitMsBeforeAsync": 2000 // BENAR
}
```
