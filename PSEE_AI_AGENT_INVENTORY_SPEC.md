# PSEE — AI Agent & Environment Inventory Specification

**Document ID:** PSEE-INV-002  
**Version:** 1.0.0  
**Status:** Physical Environment Audit Record  
**Date:** 2026-11-02  
**Auditor:** Antigravity System Auditor  
**Machine:** macOS Darwin (Apple Silicon / Intel Host)

---

## 1. Status Verifikasi Komponen

Setiap entitas dinilai berdasarkan kriteria ketat:
- `DISCOVERED`: Tercantum dalam rencana awal pengguna.
- `INSTALLED`: Terkonfirmasi ada di filesystem host.
- `VERSION_VERIFIED`: Nomor versi berhasil diekstrak dan divalidasi.
- `CONNECTIVITY_VERIFIED`: Jalur komunikasi (socket/loopback/IPC) berhasil merespons.
- `EXECUTION_VERIFIED`: Telah berhasil mengeksekusi satu pekerjaan nyata secara terkontrol.
- `ERROR`: Mengalami kegagalan koneksi atau dalam masa karantina (*quarantine*).

---

## 2. Master Component Inventory

### 2.1 Integrated Development Environments (IDEs)

#### 1. Visual Studio Code
- **Kategori:** IDE (General Development)
- **Path Terpasang:** `/Applications/Visual Studio Code.app`
- **Versi Terverifikasi:** `1.144.0` (diekstrak dari `Info.plist`)
- **CLI Helpers:** `/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code`, `code-tunnel`, `copilot-shim`
- **Metode Autentikasi:** GitHub OAuth / Microsoft Account / Settings Sync (User Session)
- **Protokol yang Didukung:** Extension API, Language Server Protocol (LSP), Model Context Protocol (MCP via extensions)
- **Kompatibilitas Model:** GitHub Copilot, Continue, Cline, Roo Code, Claude Dev, dsb.
- **Ketersediaan Free-Tier:** Software gratis open-source (Code - OSS core). Layanan AI tergantung ekstensi yang dipasang.
- **Status Verifikasi:** `VERSION_VERIFIED`
- **Kapabilitas Integrasi PSEE:**
  - *Dapat Ditemukan PSEE:* YA (Path detection).
  - *Dapat Terkoneksi:* YA (via CLI launcher `code` atau local MCP server).
  - *Dapat Eksekusi Tugas:* YA (sebagai target editor workspace / worktree viewer).
- **Batasan & Keamanan:** Sandboxed extensions. Tidak menyimpan secret di workspace.

#### 2. Cursor
- **Kategori:** AI-Native IDE (VS Code Fork)
- **Path Terpasang:** `/Applications/Cursor.app`
- **Versi Terverifikasi:** `3.27.22` (diekstrak dari `Info.plist`)
- **CLI Helpers:** `/Applications/Cursor.app/Contents/Resources/app/bin/cursor`, `code`, `cursor-tunnel`
- **Metode Autentikasi:** Cursor Account (OAuth Web Session)
- **Protokol yang Didukung:** Native AI Composer, Cursor Agent, MCP Server/Client
- **Kompatibilitas Model:** Claude 3.5 Sonnet, GPT-4o, Cursor-small, Custom OpenAI-compatible endpoints
- **Ketersediaan Free-Tier:** Menyediakan kuota bulanan gratis terbatas (biasanya 50 request premium fast / free slow requests).
- **Status Verifikasi:** `VERSION_VERIFIED`
- **Kapabilitas Integrasi PSEE:**
  - *Dapat Ditemukan PSEE:* YA.
  - *Dapat Terkoneksi:* YA (via local MCP server PSEE).
  - *Dapat Eksekusi Tugas:* YA (membuka worktree di Cursor untuk review manusia).
- **Batasan & Keamanan:** Dilarang mengekstrak session token Cursor; hanya integrasi via MCP dan workspace launch.

#### 3. Antigravity IDE
- **Kategori:** AI Agentic Development IDE
- **Path Terpasang:** `/Applications/Antigravity IDE.app`
- **Versi Terverifikasi:** `2.6.0` (diekstrak dari `Info.plist`)
- **CLI Helpers:** `/Applications/Antigravity IDE.app/Contents/Resources/app/bin/antigravity-ide`
- **Metode Autentikasi:** Google Account / Gemini Native OAuth
- **Protokol yang Didukung:** Agentic Chat, Sidecars, Custom Plugins, Extensions
- **Kompatibilitas Model:** Gemini 1.5 Pro, Gemini 1.5 Flash, Claude 3.5 Sonnet, GPT-4o (sesuai subscription)
- **Ketersediaan Free-Tier:** Tergantung akun Google / program preview.
- **Status Verifikasi:** `VERSION_VERIFIED`
- **Kapabilitas Integrasi PSEE:**
  - *Dapat Ditemukan PSEE:* YA.
  - *Dapat Terkoneksi:* YA (via CLI launcher `antigravity-ide`).
  - *Dapat Eksekusi Tugas:* YA (membuka workspace task).
- **Batasan & Keamanan:** Integrasi Antigravity via 9Router saat ini berstatus `QUARANTINED` akibat kegagalan sebelumnya, namun aplikasi IDE mandirinya siap digunakan sebagai viewer.

#### 4. Antigravity macOS Client
- **Kategori:** Native macOS Companion App
- **Path Terpasang:** `/Applications/Antigravity.app`
- **Versi Terverifikasi:** `2.28.2` (diekstrak dari `Info.plist`)
- **Binary:** `/Applications/Antigravity.app/Contents/MacOS/Antigravity`
- **Metode Autentikasi:** Google System SSO
- **Status Verifikasi:** `VERSION_VERIFIED`

#### 5. Qoder
- **Kategori:** Specialized Coding / App Development IDE
- **Path Terpasang:** `/Applications/Qoder.app`
- **Versi Terverifikasi:** `0.5.1` (diekstrak dari `Info.plist`)
- **Komponen Internal:** `appshot_bare_modifier_monitor`, `collaboration-cli`, extension `qoder.phone-use`
- **Metode Autentikasi:** Proprietary Session / User Profile
- **Status Verifikasi:** `VERSION_VERIFIED`
- **Kapabilitas Integrasi PSEE:**
  - *Dapat Ditemukan PSEE:* YA.
  - *Dapat Terkoneksi:* YA (via file system inspection / collab CLI).
  - *Status:* Pasif sebagai pendukung kolaborasi.

#### 6. Orca Studio
- **Kategori:** Multi-Agent Workspace & IDE
- **Path Terpasang:** `/Applications/Orca.app`
- **Versi Terverifikasi:** `1.4.245` (diekstrak dari `Info.plist`)
- **Binary & CLI:** `/usr/local/bin/orca` -> `/Applications/Orca.app/Contents/Resources/bin/orca`
- **Status Verifikasi:** `VERSION_VERIFIED`

---

### 2.2 CLI Coding Agents

#### 7. OpenCode CLI
- **Kategori:** Autonomous Terminal Coding Agent
- **Path Terpasang:** `/usr/local/bin/opencode` -> `../lib/node_modules/opencode-ai/bin/opencode.exe`
- **Versi Terverifikasi:** `1.17.13`
- **Metode Autentikasi:** Local provider config (`~/.local/share/opencode`), environment variables (`OPENAI_API_KEY`, dsb.)
- **Protokol yang Didukung:** CLI flags (`opencode run`), headless daemon (`opencode serve`), ACP (*Agent Client Protocol*), MCP (*Model Context Protocol*)
- **Kompatibilitas Model:** Mendukung multi-provider: Ollama, OpenRouter, OpenAI, Anthropic, Custom endpoints
- **Ketersediaan Free-Tier:** 100% Free Open Source CLI. Akses AI gratis jika dihubungkan ke Ollama atau free OpenRouter.
- **Status Verifikasi:** `VERSION_VERIFIED`
- **Kapabilitas Integrasi PSEE:**
  - *Dapat Ditemukan PSEE:* YA (`which opencode`).
  - *Dapat Terkoneksi:* YA (via ACP server atau headless subprocess).
  - *Dapat Eksekusi Tugas:* YA (target eksekutor Coder di dalam Git Worktree).

#### 8. Orca CLI
- **Kategori:** Headless Multi-Agent Orchestrator CLI
- **Path Terpasang:** `/usr/local/bin/orca`
- **Versi Terverifikasi:** `1.4.245`
- **Fitur Khusus:** Dukungan akun OpenCode dan Devin (`orca account select`), sub-command `agent-context`, headless runtime server (`orca serve`)
- **Status Verifikasi:** `VERSION_VERIFIED`
- **Kapabilitas Integrasi PSEE:**
  - *Dapat Ditemukan PSEE:* YA.
  - *Dapat Terkoneksi:* YA (via headless runtime server `orca serve`).
  - *Dapat Eksekusi Tugas:* YA (dapat menjadi backend pelaksana multi-agent).

#### 9. Claude Code CLI
- **Kategori:** Official Anthropic Terminal Agent
- **Path Terpasang:** `/usr/local/bin/claude` -> `../lib/node_modules/@anthropic-ai/claude-code/bin/claude.exe`
- **Versi Terverifikasi:** `2.1.201`
- **Metode Autentikasi:** Anthropic Console API Key atau OAuth session
- **Protokol yang Didukung:** Terminal CLI Interactive, JSON streaming output
- **Ketersediaan Free-Tier:** **TIDAK ADA FREE TIER RESMI**. Memerlukan saldo kredit Anthropic berbayar.
- **Status Verifikasi:** `VERSION_VERIFIED` (Software terpasang, namun akun pengguna belum memiliki saldo berbayar / status: `NOT_CONFIGURED` untuk routing otomatis).
- **Aturan PSEE:** Dikunci di balik *Human Approval Gate*; tidak dipanggil dalam routing otomatis Free-First.

---

### 2.3 Local Inference Engines

#### 10. Ollama Local Runtime
- **Kategori:** Local Open-Weight Model Runner
- **Path Terpasang:** `/usr/local/bin/ollama` (symlink ke `/Applications/Ollama.app/Contents/Resources/ollama`)
- **Versi Terverifikasi:** `0.31.1` (diekstrak dari `Info.plist` Ollama.app)
- **Metode Autentikasi:** Tidak ada (Local Loopback `127.0.0.1:11434`)
- **Protokol yang Didukung:** REST API OpenAI-compatible (`/v1/chat/completions`), Native Ollama API (`/api/generate`, `/api/chat`, `/api/tags`)
- **Ketersediaan Free-Tier:** 100% Gratis dan Tanpa Batas Kuota (dibatasi oleh hardware RAM/VRAM Apple Silicon).
- **Status Verifikasi:** `VERSION_VERIFIED` (Binary siap, membutuhkan verifikasi koneksi daemon saat fase implementasi).
- **Kapabilitas Integrasi PSEE:**
  - *Dapat Ditemukan PSEE:* YA.
  - *Dapat Terkoneksi:* YA (via loopback HTTP).
  - *Dapat Eksekusi Tugas:* YA (Pondasi Tier 0 untuk data berlabel `SECRET`).

---

### 2.4 AI Gateway & Model Routers

#### 11. 9Router Proxy
- **Kategori:** Local Multi-Provider Gateway & Key Aggregator
- **Versi Terlapor:** `0.5.112`
- **Port Dashboard:** `127.0.0.1:20128`
- **Metode Autentikasi:** Local Master API Key
- **Protokol yang Didukung:** OpenAI-compatible API, Anthropic-compatible API
- **Model yang Teragregasi:**
  - *OpenAI Codex:* 10 kandidat model (`cx/*`), 2 dilaporkan lulus uji awal.
  - *Gemini:* 4 label kandidat dilaporkan lulus uji awal.
  - *Kilo Free:* 11 kandidat model (`kc/*:free`).
  - *Antigravity:* 100% gagal pada uji awal (status: `QUARANTINED`).
- **Status Verifikasi:** `DISCOVERED` / `NEEDS_VERIFICATION` (Perlu verifikasi handshake port inferensi API).

---

### 2.5 Komponen yang Belum Terpasang (Missing / Not Found)

| Komponen | Kategori | Hasil Pemeriksaan Host | Rekomendasi PSEE |
|---|---|---|---|
| **Codex Standalone CLI** | CLI Tool | `codex not found` pada system PATH. | Akses Codex diarahkan melalui 9Router gateway (`cx/*`). |
| **LM Studio** | Local Inference | `lms not found` & tidak ada di `/Applications`. | Gunakan Ollama (v0.31.1) yang sudah terpasang dan siap pakai. |
| **Aider** | CLI Agent | `aider not found` pada system PATH. | Gunakan OpenCode (v1.17.13) yang memiliki kapabilitas serupa plus ACP/MCP. |
| **LiteLLM** | Gateway Proxy | Tidak terpasang di Python library. | Gunakan 9Router proxy lokal yang sudah terpasang. |
| **Legacy Gemini CLI** | CLI Tool | `gemini not found` pada system PATH. | Gunakan Direct Google AI Studio API atau OpenCode adapter. |

