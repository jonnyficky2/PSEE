# PSEE — Phase 0: Implementation Blockers & Resolution Log

**Document ID:** PSEE-BLOCK-P0-002  
**Version:** 1.0.0  
**Status:** Action Required Before Phase 1  
**Date:** 2026-11-03  
**Auditor:** Senior AI Infrastructure Engineer & macOS Environment Auditor

---

## 1. Executive Summary

Berdasarkan audit verifikasi lingkungan pada Fase 0, ditemukan **4 kondisi penghalang (*blockers*)** yang wajib diselesaikan sebelum implementasi kode Fase 1 dapat dimulai. Seluruh penghalang bersifat operasional dan konfigurasi dasar repositori, bukan kegagalan arsitektur.

---

## 2. Rincian Penghalang (Blocker Details)

### Blocker 1: Repositori Git Belum Diinisialisasi
- **Status:** `BLOCKED` (Tingkat Kritis: **KRITIS**)
- **Gejala / Bukti:** Eksekusi `git status` mengembalikan:
  ```
  fatal: not a git repository (or any of the parent directories): .git
  ```
- **Akar Masalah:** Folder `/Users/jofi/Documents/PROJECT/PSEE` belum pernah dijalankan `git init`.
- **Dampak pada Sistem:**
  - Git Worktree Isolation (`git worktree add`) **sama sekali tidak dapat berfungsi**.
  - Checkpoint Engine tidak dapat mencatat commit SHA dasar.
  - Perubahan kode oleh agent tidak memiliki jaring pengaman (*safety net*) untuk di-rollback.
- **Solusi yang Diperlukan:**
  1. Buat file `.gitignore` komprehensif.
  2. Jalankan `git init`.
  3. Lakukan commit awal (*initial commit*) berisi dokumen audit arsitektur.
- **Kriteria Verifikasi Bebas Blocker:** Perintah `git status` menghasilkan status bersih (*clean working tree*) pada branch `main`.

---

### Blocker 2: Daemon 9Router Belum Aktif (Port 20128 Tertutup)
- **Status:** `BLOCKED` (Tingkat Kritis: **TINGGI**)
- **Gejala / Bukti:**
  - Koneksi ke `http://127.0.0.1:20128` ditolak (*connection refused*).
  - Port 20128 tidak terdaftar dalam `lsof -iTCP -sTCP:LISTEN`.
  - Proses `9router` tidak ada dalam daftar proses aktif host.
- **Akar Masalah:** Binary 9Router (`/Users/jofi/.npm-global/bin/9router` v0.5.112) terpasang di sistem, namun daemon lokalnya belum dijalankan oleh pengguna.
- **Dampak pada Sistem:**
  - Model cloud gratis bersponsor (Kilo Free `kc/*:free`) tidak dapat diakses.
  - Model OpenAI Codex (`cx/*`) via 9Router tidak dapat dihubungi.
  - Healthcheck L2 untuk gateway cloud gagal.
- **Solusi yang Diperlukan:**
  - Pengguna menjalankan 9Router di terminal host:
    ```bash
    9router -n
    ```
    (opsi `-n` menjalankan tanpa membuka browser secara otomatis).
- **Kriteria Verifikasi Bebas Blocker:** `curl -s http://127.0.0.1:20128/health` atau `curl -I http://127.0.0.1:20128/` mengembalikan respons HTTP.

---

### Blocker 3: Pemetaan Provider Ollama di OpenCode Belum Dideklarasikan
- **Status:** `BLOCKED` (Tingkat Kritis: **SEDANG**)
- **Gejala / Bukti:**
  - Menjalankan `opencode models ollama` mengembalikan pesan:
    ```
    Error: Provider not found: ollama
    ```
- **Akar Masalah:** OpenCode secara bawaan mengenali 5 model gratis (`opencode/*`), namun tidak memiliki provider bawaan bernama `ollama` secara eksplisit tanpa konfigurasi tambahan di `opencode.json` atau passing variabel lingkungan OpenAI-compatible.
- **Dampak pada Sistem:**
  - Agent eksekutor OpenCode tidak bisa langsung memanggil `ollama/qwen2.5-coder:7b` jika hanya dipanggil dengan flag `--model ollama/qwen2.5-coder:7b`.
- **Solusi yang Diperlukan (Arsitektural):**
  - Pada implementasi `OpenCodeBridgeAdapter` (Fase 1/3), sistem PSEE akan menyuntikkan konfigurasi base URL OpenAI-compatible secara dinamis melalui environment variable saat memanggil OpenCode:
    ```bash
    OPENAI_BASE_URL="http://127.0.0.1:11434/v1" OPENAI_API_KEY="ollama" opencode run ...
    ```
    atau mendefinisikan provider lokal di file konfigurasi `/Users/jofi/.config/opencode/opencode.json`.
- **Kriteria Verifikasi Bebas Blocker:** OpenCode berhasil menjalankan tugas menggunakan model lokal Ollama.

---

### Blocker 4: Ketiadaan File `.gitignore` Sebelum Inisialisasi Git
- **Status:** `BLOCKED` (Tingkat Kritis: **TINGGI**)
- **Gejala / Bukti:** File `.gitignore` belum ada di root folder `/Users/jofi/Documents/PROJECT/PSEE`.
- **Dampak pada Sistem:**
  - Jika Git diinisialisasi tanpa `.gitignore`, file `.DS_Store`, file database SQLite lokal (`*.sqlite`), folder worktree `.psee/worktrees/`, atau file konfigurasi lokal berisiko masuk ke dalam version control.
- **Solusi yang Diperlukan:**
  - Buat file `.gitignore` sebelum melakukan `git add .` dan `git commit`.

---

## 3. Matriks Tindakan Penyelesaian (*Action Items Matrix*)

| ID Blocker | Deskripsi Tindakan | Penanggung Jawab | Urutan Eksekusi |
|---|---|---|---|
| `ACT-01` | Buat file `.gitignore` standar PSEE | PSEE Agent / User | Langkah 1 |
| `ACT-02` | Jalankan `git init` dan initial commit pada branch `main` | User Approval / PSEE | Langkah 2 |
| `ACT-03` | Jalankan daemon 9Router di background (`9router -n`) | Pengguna (User) | Langkah 3 |
| `ACT-04` | Siapkan konfigurasi adapter OpenCode ke Ollama OpenAI-compatible | PSEE Adapter (Fase 1) | Langkah 4 |

