---
name: pterodactyl-console-logging
description: >
  Aturan untuk memastikan setiap sistem logging (INFO/ERROR) dicetak ke console.log/console.error agar terlihat di terminal panel Pterodactyl. Jangan hanya menyimpan log ke dalam file JSON/TXT saja.
---

# Pterodactyl Console Logging

## Konteks Kesalahan
Pengguna kebingungan karena merasa AI atau sistem bot tidak berjalan (atau berhalusinasi). Ini terjadi karena sistem logger (misal `writeLog`) hanya menulis ke dalam file log lokal (`src/logs/logs.json`), tetapi tidak mencetaknya ke `console.log`. Terminal panel Pterodactyl mengandalkan output standar layar (stdout).

## Apa yang Salah
```javascript
export function writeLog(level, message, ...optionalParams) {
    // Hanya menyimpan ke file
    fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
}
```

## Kenapa Salah
Pterodactyl menangkap stdout dan stderr. Jika logger kustom tidak mem-forward pesan `INFO` ke `console.log`, pengguna tidak akan melihat apa-apa di layar terminal mereka, membuat proses debugging menjadi mustahil di dalam antarmuka panel web.

## Yang Benar
```javascript
export function writeLog(level, message, ...optionalParams) {
    fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
    
    // Selalu forward log penting ke console agar terlihat di Pterodactyl
    if (level === 'INFO') {
        const originalConsoleLog = console.log;
        originalConsoleLog(`[INFO] ${message}`, ...(optionalParams.length > 0 ? optionalParams : []));
    }
}
```

## Aturan
- **JANGAN** menggunakan logger yang murni menulis file secara tertutup tanpa meneruskannya ke stdout.
- **SELALU** pastikan `INFO`, `WARN`, `ERROR` dicetak ke console bawaan NodeJS jika environment aplikasi berjalan di Pterodactyl.
