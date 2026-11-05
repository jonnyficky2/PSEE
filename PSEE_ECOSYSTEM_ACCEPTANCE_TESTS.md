# PSEE — Ecosystem Acceptance Tests & Verification Suite

**Document ID:** PSEE-TEST-008  
**Version:** 1.0.0  
**Status:** Approved Test Specification  
**Date:** 2026-11-02  
**Scope:** Verification of Discovered IDEs, CLIs, Gateways, Isolation Boundaries, & Safety Gates

---

## 1. Test Suite Index

| Test ID | Kategori Pengujian | Komponen Target | Tujuan Utama |
|---|---|---|---|
| `TC-ECO-01` | Binary Integrity & Discovery | Seluruh IDE & CLI terpasang | Memastikan binary/app fisik dapat dideteksi dan versinya terbaca. |
| `TC-ECO-02` | Local Inference Zero-Leakage | Ollama Local (`127.0.0.1:11434`) | Memverifikasi inferensi lokal tanpa lalu lintas jaringan keluar. |
| `TC-ECO-03` | Headless Worktree Execution | OpenCode CLI (`/usr/local/bin/opencode`) | Memverifikasi penulisan kode terisolasi di dalam Git Worktree. |
| `TC-ECO-04` | Gateway Handshake & Rate-Limit | 9Router Proxy (`127.0.0.1:20128`) | Menguji konektivitas model gratis dan penanganan HTTP 429. |
| `TC-ECO-05` | Quarantined Model Enforcement | Antigravity Integration | Memastikan model karantina tidak pernah terpanggil otomatis. |
| `TC-ECO-06` | Strict Paid Approval Gate | Claude Code CLI (`/usr/local/bin/claude`) | Memastikan alat berbayar terblokir tanpa izin manusia eksplisit. |
| `TC-ECO-07` | Local MCP Surface Integration | Cursor & VS Code MCP | Memverifikasi komunikasi Model Context Protocol lokal. |
| `TC-ECO-08` | End-to-End Hybrid Workflow | Gemini + OpenCode + Worktree | Uji coba siklus lengkap: Plan $\rightarrow$ Code $\rightarrow$ Test $\rightarrow$ Review. |

---

## 2. Rincian Skenario Pengujian

### TC-ECO-01: Discovered Binary Integrity & Metadata Probe
- **Prasyarat:** Lingkungan host macOS.
- **Langkah Pengujian:**
  1. Jalankan probe versi untuk seluruh komponen yang ditemukan:
     - `/usr/local/bin/opencode --version`
     - `/usr/local/bin/orca --version`
     - `/usr/local/bin/claude --version`
     - `plutil -extract CFBundleShortVersionString raw "/Applications/Cursor.app/Contents/Info.plist"`
     - `plutil -extract CFBundleShortVersionString raw "/Applications/Visual Studio Code.app/Contents/Info.plist"`
     - `plutil -extract CFBundleShortVersionString raw "/Applications/Antigravity IDE.app/Contents/Info.plist"`
     - `plutil -extract CFBundleShortVersionString raw "/Applications/Ollama.app/Contents/Info.plist"`
- **Kriteria Lolos (Pass Assertions):**
  - Seluruh perintah mengembalikan versi yang valid (`1.17.13`, `1.4.245`, `2.1.201`, `3.27.22`, `1.144.0`, `2.6.0`, `0.31.1`).
  - Output dicatat dalam status `VERSION_VERIFIED` pada registri.

---

### TC-ECO-02: Ollama Local Inference & Zero-Leakage Test
- **Prasyarat:** Daemon Ollama berjalan lokal.
- **Langkah Pengujian:**
  1. Jalankan packet sniffing ringan pada interface network eksternal (misal: `en0`).
  2. Kirim request HTTP POST ke `http://127.0.0.1:11434/api/generate` dengan prompt: `"Explain binary search in 2 sentences"`.
  3. Periksa respons dari endpoint loopback.
- **Kriteria Lolos (Pass Assertions):**
  - Menerima respons berstatus 200 OK dalam batas waktu 15 detik.
  - **Zero External Packets:** Nol paket data dikirim ke internet publik selama proses inferensi berlangsung.
  - Model dipromosikan ke status `CONNECTIVITY_VERIFIED`.

---

### TC-ECO-03: OpenCode Headless Execution in Worktree
- **Prasyarat:** Git repository telah diinisialisasi; branch `main` bersih.
- **Langkah Pengujian:**
  1. PSEE membuat worktree terisolasi: `git worktree add -b task/test-opencode .psee/worktrees/task-test-opencode`.
  2. Jalankan OpenCode dalam mode headless murni:
     ```bash
     opencode run "Create a file named math_utils.py with an add function" --pure
     ```
     dengan direktori kerja (`cwd`) disetel ke `.psee/worktrees/task-test-opencode`.
  3. Periksa status file di root workspace (`/Users/jofi/Documents/PROJECT/PSEE`).
  4. Periksa file `math_utils.py` di dalam worktree.
- **Kriteria Lolos (Pass Assertions):**
  - Proses keluar dengan exit code 0.
  - File `math_utils.py` terbentuk dengan benar di dalam direktori worktree.
  - **Zero Workspace Contamination:** Root workspace pengguna tetap bersih dan tidak tersentuh.
- **Rollback / Cleanup:** Jalankan `git worktree remove --force .psee/worktrees/task-test-opencode` dan `git branch -D task/test-opencode`.

---

### TC-ECO-04: 9Router Free Gateway & Cooldown Verification
- **Prasyarat:** 9Router Proxy berjalan lokal.
- **Langkah Pengujian:**
  1. Kirim request terkontrol ke endpoint 9Router untuk model `kc/kilo-auto/free`.
  2. Simulasikan pengiriman respons HTTP 429 (Too Many Requests).
  3. Verifikasi apakah PSEE mencatat status `RATE_LIMITED` dan mengaktifkan timer cooldown.
  4. Ajukan request berikutnya untuk task yang sama.
- **Kriteria Lolos (Pass Assertions):**
  - PSEE tidak melakukan spam request ke model yang sedang rate-limited.
  - Sistem secara otomatis mengalihkan request ke model lokal Ollama (Tier 0 Fallback).
  - Alasan perpindahan tercatat rapi di tabel `routing_logs`.

---

### TC-ECO-05: Quarantined Antigravity Isolation Verification
- **Prasyarat:** Model Antigravity terdaftar di tabel `ai_models` dengan status `QUARANTINED`.
- **Langkah Pengujian:**
  1. Ajukan serangkaian tugas (Planning, Coding, Review) tanpa menentukan model secara manual.
  2. Biarkan policy engine memilih model terbaik secara otomatis.
- **Kriteria Lolos (Pass Assertions):**
  - Dari 100 simulasi keputusan routing, **nol persen (0%)** tugas yang dialokasikan ke model Antigravity.
  - Status karantina terbukti melindungi eksekusi dari kegagalan berulang.

---

### TC-ECO-06: Strict Paid Approval Gate on Claude Code
- **Prasyarat:** Claude Code CLI terpasang di `/usr/local/bin/claude`.
- **Langkah Pengujian:**
  1. Ajukan tugas perbaikan kode kompleks dan setel seluruh model gratis ke status unavailable.
  2. Sistem mengevaluasi model berbayar `claude-3-5-sonnet` sebagai alternatif terakhir.
- **Kriteria Lolos (Pass Assertions):**
  - PSEE **dilarang memanggil `claude` CLI secara otomatis**.
  - Eksekusi langsung berhenti pada status `NEEDS_USER`.
  - Sistem menampilkan dialog estimasi biaya di antarmuka dan meminta konfirmasi pengguna: *"Model berbayar Claude 3.5 Sonnet memerlukan persetujuan sebelum dipanggil. Izinkan? (Y/N)"*.

---

### TC-ECO-07: Local MCP Surface Handshake (Cursor & VS Code)
- **Prasyarat:** PSEE Local MCP Server dijalankan (`psee mcp --port 3000`).
- **Langkah Pengujian:**
  1. Hubungkan client Cursor atau VS Code ke MCP endpoint lokal.
  2. Panggil tool `psee_list_tasks` dari panel IDE.
- **Kriteria Lolos (Pass Assertions):**
  - Client IDE berhasil menerima daftar task aktif beserta status checkpoint dalam format JSON-RPC standar.

---

### TC-ECO-08: End-to-End Hybrid Workflow Verification
- **Prasyarat:** Seluruh modul terintegrasi.
- **Alur Pengujian:**
  1. **Langkah 1 (Plan):** Model Gemini Free merumuskan spesifikasi pembuatan modul kalkulator string.
  2. **Langkah 2 (Isolate):** PSEE membuat branch `task/calc` dan worktree `.psee/worktrees/task-calc`.
  3. **Langkah 3 (Code):** OpenCode ditenagai Ollama lokal mengimplementasikan kode di worktree.
  4. **Langkah 4 (Test):** Unit test dijalankan di worktree dan lulus 100%.
  5. **Langkah 5 (Checkpoint):** Snapshot status disimpan ke database SQLite.
  6. **Langkah 6 (Approval & Merge):** Pengguna melihat `git diff` di panel Cursor, menekan tombol **"Approve Merge"**, dan kode masuk ke branch utama.
- **Kriteria Lolos (Pass Assertions):**
  - Seluruh alur berjalan lancar tanpa intervensi manual selain persetujuan akhir.
  - Biaya finansial yang dikeluarkan tercatat: **$0.00**.

