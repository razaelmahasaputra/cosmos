---
name: artifact-path-validation
description: Dokumentasi penanganan error validasi jalur (path) dan metadata saat membuat/mengedit file proyek atau artifact.
---

# Penanganan Validasi Jalur File dan Metadata Artifact

Dokumentasi ini dibuat setelah terjadi kesalahan pemanggilan tool `write_to_file` di mana parameter `ArtifactMetadata` disertakan pada file proyek reguler (di luar direktori artifact).

## Detail Masalah

Ketika memanggil tool `write_to_file` atau `replace_file_content`/`multi_replace_file_content` untuk membuat atau mengedit file proyek biasa (seperti berkas di bawah `/data/data/com.termux/files/home/waf/`), menyertakan parameter `ArtifactMetadata` akan memicu error validasi jalur. Sistem hanya memperbolehkan metadata artifact pada berkas yang terletak di dalam direktori brain artifact:
`/data/data/com.termux/files/home/.gemini/antigravity-cli/brain/17df30be-ca16-45af-a960-d7916c875734/`

## Solusi / Pencegahan

1. **File Proyek Biasa**: Untuk file di dalam repositori kode/workspace utama (misal `/src/...`, `package.json`, `.agents/...`), **jangan pernah** menyertakan parameter `ArtifactMetadata`.
2. **File Artifact**: Sertakan parameter `ArtifactMetadata` **hanya jika** jalur berkas (`TargetFile`) berada di bawah direktori brain artifact.
