# PSEE — Existing Ecosystem Capability Baseline

**Document ID:** PSEE-BASELINE-001  
**Version:** 1.0.0  
**Status:** Read-only audit completed  
**Date:** 2026-11-05 22:51 WIB (2026-11-05T15:51Z)  
**Auditor role:** Senior macOS Environment Auditor & AI Infrastructure Engineer  
**Workspace:** `/Users/jofi/Documents/PROJECT/PSEE`  
**Host:** macOS 26.4 (build 25E246), Apple Silicon (`arm64`), 16 GB RAM, 10 CPU cores, 460 GiB volume / 302 GiB free  
**Mode:** READ-ONLY — no installation, download, configuration change, cleanup, or deletion was performed during this audit.

---

## 0. Classification Legend & Evidence Rules

| Class | Meaning |
|---|---|
| `VERIFIED` | Confirmed empirically in this audit by command output, live service response, or direct file/database read. |
| `UNVERIFIED` | Installed or registered, but execution could not be exercised headlessly or was not exercised in this audit. |
| `UNAVAILABLE` | Present/discoverable but not usable at audit time (quota, missing dependency, stopped runtime, credentials absent). |
| `UNKNOWN` | No reliable evidence; value/behavior is not discoverable from the filesystem, CLI, or API. |

Rules applied:

- Every numeric or configuration claim below is backed by a command, file path, or API response recorded in this document.
- Credentials are never reproduced. API keys/tokens are shown only as `<REDACTED>`.
- Account names are not reproduced; only provider-level counts are listed.
- `UNKNOWN` is **not** equivalent to unlimited. No provider or model in this audit is classified as unlimited unless explicitly evidenced; none were.

---

## 1. IDE Inventory

### 1.1 Installed IDEs

**Total installed IDEs: 7.**  
There are **43 applications** in `/Applications`; only the 7 below meet the IDE definition. `Orca` is installed but is an agent/worktree orchestrator, not an IDE (see §3).

| # | IDE | Version | Installation path | AI integrations available | Default AI model | Class |
|---|---|---|---|---|---|---|
| 1 | Visual Studio Code | 1.145.0 | `/Applications/Visual Studio Code.app` | Built-in GitHub Copilot Chat + 6 AI extensions | `copilot/auto` (Copilot Chat); Copilot CLI agent `claude-haiku-4.5`; Claude Code mapping `gh/gpt-5.4-nano` / `gh/gpt-4.1` / `ag/gemini-3.8-flash-low` | VERIFIED |
| 2 | Cursor | 3.28.7 | `/Applications/Cursor.app` | Built-in Cursor AI; only `anysphere.remote-ssh` extension | Main chat model **UNKNOWN**; subagent `explore` = `gemini-4-argon` | VERIFIED / UNKNOWN |
| 3 | Antigravity | 2.28.2 | `/Applications/Antigravity.app` | Built-in Antigravity agent (Google) | `gpt-oss-120b-medium` (`MODEL_OPENAI_GPT_OSS_120B_MEDIUM`) | VERIFIED |
| 4 | Antigravity IDE | 2.6.0 (app) / 1.107.0 (CLI) | `/Applications/Antigravity IDE.app` | Built-in Antigravity agent; Claude Code, Gemini Code Assist, ChatGPT/Codex extensions | **UNKNOWN** (no independent model preference found) | UNKNOWN |
| 5 | Android Studio | 2026.2 (build `AI-262.9437.185.2621.16467767`) | `/Applications/Android Studio.app` | Gemini plugin `262.9437.185.2621.16467767`; Lume AI plugin | Gemini (service-managed; exact model not exposed) | UNVERIFIED |
| 6 | Eclipse | 4.42.0 (build `4.42.0.20261008-0639`) | `/Applications/Eclipse.app` | **None** (0 AI plugins among 786 plugins) | N/A | UNAVAILABLE |
| 7 | Qoder | 0.5.1 | `/Applications/Qoder.app` | Built-in Qoder agent | `auto` | VERIFIED (config) / UNVERIFIED (execution) |

Evidence:

- Versions read from each app's `Contents/Info.plist` (`CFBundleShortVersionString`).
- Android Studio build from `/Applications/Android Studio.app/Contents/Resources/product-info.json`.
- Eclipse build from `defaults read /Applications/Eclipse.app/Contents/Info.plist CFBundleVersion`.
- AI extension inventory from `code --list-extensions --show-versions` (16), `antigravity-ide --list-extensions --show-versions` (19), and `cursor --list-extensions --show-versions` (1).
- Eclipse plugin scan: `ls /Applications/Eclipse.app/Contents/Eclipse/plugins | grep -icE 'copilot|claude|gemini|openai|codeium|continue'` → `0`.

### 1.2 AI integrations by IDE

**Visual Studio Code — 16 extensions, 7 AI-capable:**

| Extension | Version | Role |
|---|---|---|
| `anthropic.claude-code` | 2.1.318 | Claude Code agent in IDE |
| `continue.continue` | 2.0.0 | Local/remote chat + autocomplete |
| `google.geminicodeassist` | 2.107.0 | Gemini Code Assist |
| `google.gemini-cli-vscode-ide-companion` | 0.20.0 | Gemini CLI IDE companion (CLI itself absent) |
| `google.google-antigravity` | 1.10.0 | Antigravity agent integration |
| `openai.chatgpt` | 26.1021.22027 | ChatGPT/Codex agent |
| `openai.codex-audio` | 26.1021.22027 | Codex audio companion |
| Built-in `copilot` | bundled with VS Code 1.145.0 | GitHub Copilot Chat (verified by built-in extension folder) |

Additional evidence: `chat.cachedLanguageModels.v2` includes `copilotcli/auto`, `GPT-4o`, `claude-fable-5.1`, `gpt-4o-mini`; `github.copilot-github` account is registered; `chat.usageBasedBilling = true`.

**Cursor — 1 extension:** `anysphere.remote-ssh@1.1.17`. All other AI is native to Cursor. `cursor/subagentModelOverrides` = `{"explore":{"modelConfig":{"modelName":"gemini-4-argon",...}}}`. No main-chat model key was found in `ItemTable` or `cursorDiskKV`; the agent-host database (`anysphere.cursor-agent-host/data.sqlite`) returned no readable rows.

**Antigravity — native agent.** `agy models` returns 6 selectable models:

```
gemini-3.8-flash-high      Gemini 3.8 Flash (High)
gemini-3.8-flash-medium    Gemini 3.8 Flash (Medium)
gemini-3.8-flash-low       Gemini 3.8 Flash (Low)
claude-sonnet-4-6          Claude Sonnet 4.6 (Thinking)
claude-opus-4-6-thinking   Claude Opus 4.6 (Thinking)
gpt-oss-120b-medium        GPT-OSS 120B (Medium)
```

`agy agents` returns 1 custom agent: `firestore-rules-author`.

**Antigravity IDE — 19 extensions, 5 AI-capable:** `anthropic.claude-code@2.1.318`, `google.geminicodeassist@2.107.0`, `openai.chatgpt@26.1021.22027`, `openai.codex-audio@26.1021.22027`, plus the built-in Antigravity agent. No Claude Code/Codex model state was found in the IDE's own settings; only the shared Claude Code mapping is visible (`ag/gemini-3.8-flash-low` as the Haiku alias in workspace state).

**Android Studio — Gemini plugin** (`plugins/gemini/lib/aiplugin.jar`, plugin descriptor name `Gemini`, version `262.9437.185.2621.16467767`) and `lume-aiplugin/lib/aiplugin-lightbuild.jar`. The model is service-managed and not exposed as a user-selectable ID.

**Eclipse — no AI integration.** 786 plugins, none matching AI/agent vendors.

**Qoder — native agent.** `~/.qoder/.models/default` contains `{"key":"auto","scene":"app",...}`; `~/.qoder/state.json` shows `lastLoginMethod: job_token`. No extension folder is used.

---

## 2. CLI Inventory

### 2.1 Count

**25 CLI entry points discovered: 23 executable, 2 unavailable.**

- 20 on `PATH` (1 of which, `xcodebuild`, is non-functional without Xcode)
- 4 usable CLI binaries bundled inside IDE apps (`code`, `cursor`, `antigravity-ide`, `agy`)
- 1 launcher present but CLI not installed (`qoder`)
- 2 additional agent binaries bundled inside extensions, not on `PATH` (`codex`, `claude` duplicate)

### 2.2 Inventory on `PATH`

| CLI | Version | Binary path | Execution | Class |
|---|---|---|---|---|
| `node` | v24.16.0 | `/usr/local/bin/node` | OK | VERIFIED |
| `npm` | 11.13.0 | `/usr/local/bin/npm` | OK | VERIFIED |
| `npx` | 11.13.0 | `/usr/local/bin/npx` | OK | VERIFIED |
| `python3` | 3.15.2 | `/Library/Frameworks/Python.framework/Versions/3.15/bin/python3` | OK | VERIFIED |
| `pip3` | 26.2.2 | `/Library/Frameworks/Python.framework/Versions/3.15/bin/pip3` | OK | VERIFIED |
| `git` | 2.50.1 (Apple Git-155) | `/usr/bin/git` | OK | VERIFIED |
| `gh` | 2.103.3 | `/opt/homebrew/bin/gh` | OK | VERIFIED |
| `gcloud` | 570.0.0 | `/opt/homebrew/bin/gcloud` | OK | VERIFIED |
| `java` | 1.8.0_202 | `/usr/bin/java` | OK (legacy JRE 8) | VERIFIED |
| `javac` | 1.8.0_504 | `/usr/bin/javac` | OK | VERIFIED |
| `sqlite3` | 3.51.0 | `/usr/bin/sqlite3` | OK | VERIFIED |
| `jq` | 1.7.1-apple | `/usr/bin/jq` | OK | VERIFIED |
| `ruby` | 2.6.10p210 | `/usr/bin/ruby` | OK | VERIFIED |
| `gem` | 3.0.3.1 | `/usr/bin/gem` | OK | VERIFIED |
| `swift` | 6.3.2 (swiftlang-6.3.2.1.108) | `/usr/bin/swift` | OK | VERIFIED |
| `xcodebuild` | — | `/usr/bin/xcodebuild` | Fails: requires Xcode, only CommandLineTools installed | UNAVAILABLE |
| `opencode` | v2.2.5 | `/Users/jofi/.npm-global/bin/opencode` | OK | VERIFIED |
| `claude` | 2.1.201 (Claude Code) | `/usr/local/bin/claude` | OK | VERIFIED |
| `orca` | 1.4.245 | `/usr/local/bin/orca` | Binary OK; runtime not running | VERIFIED / UNAVAILABLE runtime |
| `ollama` | 0.31.1 | `/usr/local/bin/ollama` | OK; daemon reachable | VERIFIED |

### 2.3 CLI binaries bundled in IDEs

| CLI | Version | Path | Execution | Class |
|---|---|---|---|---|
| `code` | 1.145.0 (`a717861c…`) | `/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code` | OK | VERIFIED |
| `cursor` | 3.28.7 (`25b52e7d…`) | `/Applications/Cursor.app/Contents/Resources/app/bin/cursor` | OK | VERIFIED |
| `antigravity-ide` | 1.107.0 (`9e3a5da5…`) | `/Applications/Antigravity IDE.app/Contents/Resources/app/bin/antigravity-ide` | OK | VERIFIED |
| `agy` | 1.5.1 | `~/.gemini/bin/agy` | Models list OK; prompt execution quota-blocked | VERIFIED / UNAVAILABLE quota |
| `qoder` | — | `~/.qoder/entry/qoder` | “Qoder CLI is not installed” | UNAVAILABLE |

### 2.4 Agent binaries bundled in extensions (not on `PATH`)

| Binary | Version | Path | Execution | Class |
|---|---|---|---|---|
| `codex` | 0.164.0-alpha.11.1 | `~/.vscode/extensions/openai.chatgpt-26.1021.22027-darwin-arm64/bin/macos-aarch64/codex` | OK (`codex exec` returned `ok`) | VERIFIED |
| `claude` | 2.1.318 | `~/.vscode/extensions/anthropic.claude-code-2.1.318-darwin-arm64/resources/native-binary/claude` | Duplicate of CLI backend | VERIFIED |

### 2.5 Development CLIs not present

Verified absent via `command -v`: `pnpm`, `yarn`, `bun`, `flutter`, `dart`, `mvn`, `gradle`, `docker`, `kubectl`, `terraform`, `aws`, `az`, `vercel`, `netlify`, `wrangler`, `php`, `composer`, `mysql`, `go`, `rustc`, `cargo`, `ffmpeg`, `codex` (PATH), `gemini` (PATH), `aider`, `goose`, `amp`, `crush`.

Class: `UNAVAILABLE`.

Note: `~/Downloads/flutter/` exists, but `flutter` is not on `PATH` and `dart` is absent; the SDK is not wired into the shell. `gcloud` is installed through Homebrew at `/opt/homebrew/Caskroom/gcloud-cli/570.0.0/`, independent of the older extracted copy that was moved to Trash.

---

## 3. AI Agent Inventory

**16 agent surfaces discovered. 14 are registered (credential/config present). 3 are verified executable end-to-end. 9 are registered but not headlessly verified. 4 are unavailable at audit time. 1 has a broken sub-route.**

| # | Agent / surface | Type | Registration evidence | Execution evidence | Status |
|---|---|---|---|---|---|
| 1 | OpenCode CLI | CLI agent | `~/.config/opencode/opencode.json` provider `9router`, 43 models | `opencode run --standalone --model 9router/ag/gemini-3.8-flash-low "Reply with exactly: ok"` → `build · ag/gemini-3.8-flash-low` / `ok`, exit 0 | **VERIFIED usable** |
| 2 | Claude Code CLI | CLI agent | `~/.claude/settings.json` → 9Router endpoint + model mapping | `claude -p "Reply with exactly: ok"` → `ok`, exit 0 | **VERIFIED usable** |
| 3 | Claude Code extension | IDE agent | `anthropic.claude-code@2.1.318` in VS Code and Antigravity IDE; same `~/.claude/settings.json` | Backend verified via #2; IDE UI run not exercised | VERIFIED registered / UNVERIFIED UI |
| 4 | Codex CLI | CLI agent | `~/.codex/auth.json` exists (not read); `~/.codex/config.toml` | `codex exec --skip-git-repo-check "Reply with exactly: ok"` → `ok`, 13.989 tokens | **VERIFIED usable (default profile)** |
| 5 | Codex extension | IDE agent | `openai.chatgpt@26.1021.22027` in VS Code and Antigravity IDE | Backend verified via #4; extension UI run not exercised | VERIFIED registered / UNVERIFIED UI |
| 6 | Antigravity CLI (`agy`) | CLI agent | Google OAuth under `~/.gemini/`; `agy models` returns 6 models | `agy -p "Reply with exactly: ok"` → `429 RESOURCE_EXHAUSTED: Individual quota reached ... resets in 94h26m22s` | **UNAVAILABLE (quota)** |
| 7 | Antigravity desktop agent | GUI agent | `~/.gemini/antigravity/antigravity_state.pbtxt`; conversation/brain history present | GUI not testable headlessly | UNVERIFIED |
| 8 | Antigravity IDE agent | GUI agent | `~/.gemini/antigravity-ide/` conversations; built-in Antigravity extension | GUI not testable headlessly | UNVERIFIED |
| 9 | Qoder IDE agent | GUI agent | `~/.qoder/state.json` (`job_token` login); default model `auto` | GUI not testable headlessly; `qoder` CLI not installed | UNVERIFIED (IDE) / UNAVAILABLE (CLI) |
| 10 | GitHub Copilot Chat | IDE agent | Built-in `copilot` extension; account registered; `chat.currentLanguageModel.terminal = copilot/auto` | No headless CLI available | UNVERIFIED |
| 11 | Gemini Code Assist | IDE agent | `google.geminicodeassist@2.107.0`; project `bright-arc-498616-f6`; telemetry disabled | No headless CLI available | UNVERIFIED |
| 12 | Gemini CLI | CLI agent | `google.gemini-cli-vscode-ide-companion@0.20.0` installed | `gemini` binary absent; companion requires external Gemini CLI | **UNAVAILABLE** |
| 13 | Continue | IDE agent | `continue.continue@2.0.0`; `~/.continue/config.yaml` (5 models) | Local models partially present (see below); no headless run | UNVERIFIED |
| 14 | Orca orchestrator + workers | Orchestrator | `orca` 1.4.245; `~/.orca/agent-hooks/claude-hook.sh`; `agent hooks status` → `claude: installed`, all others `not_installed` | `orca status` → `runtimeState: not_running`, `runtimeReachable: false`; `orca account list` → runtime metadata missing | **UNAVAILABLE (runtime stopped)** |
| 15 | Android Studio Gemini | IDE agent | Gemini plugin `262.9437.185.2621.16467767`; Lume AI plugin | No headless interface | UNVERIFIED |
| 16 | Eclipse AI | IDE agent | None | None | **UNAVAILABLE (no agent)** |

### 3.1 Broken agent routes

| Route | Evidence | Class |
|---|---|---|
| Codex profile `ag` | `~/.codex/ag.config.toml` sets `model = "ag/gemini-3.6-flash-high"` and `model_provider = "9router"`. `codex exec -p ag ...` → `Error: Model provider '9router' not found` | **BROKEN** |
| Antigravity CLI prompt path | `agy -p ...` → `429` individual quota, reset in ~94 h | UNAVAILABLE (temporary) |
| Orca worker/account APIs | Runtime stopped; `orca account list` requires `orca open` | UNAVAILABLE (temporary) |
| Qoder CLI | `~/.qoder/entry/qoder --version` → `Qoder CLI is not installed` | UNAVAILABLE |

### 3.2 Continue model coverage

`~/.continue/config.yaml` declares 5 models:

- `Qwen 2.5 Coder 3B` → `ollama/qwen2.5-coder:3b` — present locally
- `Qwen 2.5 Coder 7B` → `ollama/qwen2.5-coder:7b` — present locally
- `Qwen 2.5 14b` → `ollama/qwen2.5:14b` — **not installed**
- `Qwen 2.5 3B` → `ollama/qwen2.5:3b` — present locally
- `GPT-5.4 Pro` → `openai/gpt-5.4-pro` with API key present (redacted) — not tested

`ollama list` returns exactly: `qwen2.5-coder:7b` (4.7 GB), `qwen3:14b` (9.3 GB), `qwen2.5-coder:3b` (1.9 GB), `qwen2.5:3b` (1.9 GB). Therefore 3 of 5 Continue models are locally satisfied; 1 is missing; 1 is unverified.

---

## 4. Model & Provider Inventory

### 4.1 Discovery totals

| Inventory | Count | Source |
|---|---:|---|
| Models exposed by 9Router | **103** | `GET http://127.0.0.1:20128/v1/models` |
| Models configured in OpenCode | **43** | `~/.config/opencode/opencode.json` |
| Models verified alive (this audit) | **43** | Live request test |
| Models verified unavailable (this audit) | **60** | Live request test |
| Models with context ≥ 500K (alive) | **16** | Catalog `context_length` |
| Local Ollama models | **4** | `ollama list` |
| 9Router provider prefixes | **7** | Catalog IDs |
| 9Router provider connections | **11** | `providerConnections` (read-only) |
| Active 9Router API keys | **2** | `apiKeys where isActive=1` (values withheld) |

### 4.2 Provider classification

| Prefix | Provider | Connections | Type | Alive / total | Connectivity | Limit evidence | Class |
|---|---|---|---:|---|---:|---|---|
| `ag` | Antigravity (Google OAuth) | 3 accounts | **Freemium** | 7 / 27 | Reachable | `agy` prompt → 429 “Individual quota reached … resets in 94h26m22s” | VERIFIED |
| `cx` | Codex / ChatGPT | 3 accounts | **Paid / freemium** (ChatGPT plan) | 10 / 20 | Reachable | 10 models → 400 `model_not_supported` (plan) | VERIFIED |
| `gh` | GitHub Copilot | 1 account | **Paid / freemium** (Copilot plan) | 13 / 26 | Reachable | 13 models → 400 `model_not_supported`; one 429 `too many requests (reset after 2s)` | VERIFIED |
| `gemini` | Google Gemini API | 3 API keys | **Freemium** (free tier + paid) | 5 / 9 | Reachable | 4 models → 429 `You exceeded your current quota` | VERIFIED |
| `kc` | Kilocode | 1 account | **Paid** (prepaid credits) | 0 / 8 | Reachable but blocked | 8 models → 402 `Paid Model - Credits Required` | VERIFIED |
| `oc` | OpenCode Zen | 0 connection rows (built-in) | **Free** (rate-limited) | 8 / 12 | Reachable | 4 models unavailable (`Model is unavailable`, protocol unsupported); free-tier 429 `FreeUsageLimitError` observed earlier in this environment | VERIFIED |
| `mmf` | Unknown (`mmf`) | 0 connection rows | **UNKNOWN** | 0 / 1 | Reachable but rejected | 400 `Unsupported model mimo-auto` | UNKNOWN |
| — | Ollama (local) | local daemon | **Local / free** | 4 models | Reachable | No provider rate limit; bounded by local hardware | VERIFIED |

Provider classification evidence:

- `providerConnections` has 11 active rows: 3 `antigravity`, 3 `codex`, 3 `gemini`, 1 `github`, 1 `kilocode`. No row exists for `opencode` or `mmf`.
- No provider exposes numeric RPM/TPM quotas through 9Router. The only verifiable limit signals are the provider errors above. Numeric rate limits are therefore `UNKNOWN`.
- **No provider is classified as unlimited.** `UNKNOWN` means the ceiling was not observable, not that no ceiling exists.

### 4.3 Models verified alive (43)

Test method: `POST /v1/chat/completions` with `max_tokens: 16`, prompt `say ok`; fallback `POST /v1/messages`; two attempts for ambiguous cases. Test time: 2026-11-05 22:42 WIB.

| Model | Context | Max output | Provider | Class |
|---|---:|---:|---|---|
| `ag/gemini-3.8-flash` | 1,048,576 | 65,536 | ag | VERIFIED |
| `ag/gemini-3.8-flash-high` | 1,048,576 | 65,536 | ag | VERIFIED |
| `ag/gemini-3.8-flash-medium` | 1,048,576 | 65,536 | ag | VERIFIED |
| `ag/gemini-3.8-flash-low` | 1,048,576 | 65,536 | ag | VERIFIED |
| `ag/claude-sonnet-4-6` | 1,000,000 | 128,000 | ag | VERIFIED |
| `ag/claude-opus-4-6-thinking` | 200,000 | 64,000 | ag | VERIFIED |
| `ag/gpt-oss-120b-medium` | 128,000 | 64,000 | ag | VERIFIED |
| `cx/gpt-5.6-luna[1m]` | 872,000 | 128,000 | cx | VERIFIED |
| `cx/gpt-5.6-terra[1m]` | 872,000 | 128,000 | cx | VERIFIED |
| `cx/gpt-6-luna[1m]` | 872,000 | 128,000 | cx | VERIFIED |
| `cx/gpt-5.6-luna` | 272,000 | 128,000 | cx | VERIFIED |
| `cx/gpt-5.6-luna-review` | 272,000 | 128,000 | cx | VERIFIED |
| `cx/gpt-5.6-terra` | 272,000 | 128,000 | cx | VERIFIED |
| `cx/gpt-5.6-terra-review` | 272,000 | 128,000 | cx | VERIFIED |
| `cx/gpt-6-luna` | 272,000 | 128,000 | cx | VERIFIED |
| `cx/codex-auto-review` | 200,000 | 64,000 | cx | VERIFIED |
| `cx/gpt-reserve` | 200,000 | 64,000 | cx | VERIFIED |
| `gemini/gemini-3-flash-preview` | 1,048,576 | 65,536 | gemini | VERIFIED |
| `gemini/gemini-3.1-flash-lite-preview` | 1,048,576 | 65,536 | gemini | VERIFIED |
| `gemini/gemini-3.5-flash-lite` | 1,048,576 | 65,536 | gemini | VERIFIED |
| `gemini/gemini-3.6-flash` | 1,048,576 | 65,536 | gemini | VERIFIED |
| `gemini/gemma-4-31b-it` | 262,144 | 32,768 | gemini | VERIFIED (slow: 67 s) |
| `gh/gpt-4.1` | 1,000,000 | 32,768 | gh | VERIFIED |
| `gh/gpt-4.1-2025-04-14` | 1,000,000 | 32,768 | gh | VERIFIED |
| `gh/gpt-5.4-nano` | 400,000 | 128,000 | gh | VERIFIED |
| `gh/copilot-search-a` | 200,000 | 64,000 | gh | VERIFIED |
| `gh/copilot-search-b` | 200,000 | 64,000 | gh | VERIFIED |
| `gh/gpt-4-o-preview` | 128,000 | 64,000 | gh | VERIFIED |
| `gh/gpt-4o` | 128,000 | 16,384 | gh | VERIFIED |
| `gh/gpt-4o-2024-05-13` | 128,000 | 16,384 | gh | VERIFIED |
| `gh/gpt-4o-2024-08-06` | 128,000 | 16,384 | gh | VERIFIED |
| `gh/gpt-4o-2024-11-20` | 128,000 | 16,384 | gh | VERIFIED |
| `gh/gpt-4o-mini` | 128,000 | 16,384 | gh | VERIFIED |
| `gh/gpt-4o-mini-2024-07-18` | 128,000 | 16,384 | gh | VERIFIED |
| `gh/gpt-3.5-turbo-0613` | 16,385 | 4,096 | gh | VERIFIED connectivity; response includes non-standard `padding` field — response hygiene UNVERIFIED |
| `oc/mimo-v2.6-flash-free` | 1,048,576 | 131,072 | oc | VERIFIED |
| `oc/glm-5.3-flash-free` | 1,000,000 | 128,000 | oc | VERIFIED |
| `oc/deepseek-v4.1-flash-free` | 330,000 | 128,000 | oc | VERIFIED |
| `oc/beam-free` | 200,000 | 64,000 | oc | VERIFIED |
| `oc/big-pickle` | 200,000 | 32,000 | oc | VERIFIED |
| `oc/flint-40b-free` | 200,000 | 64,000 | oc | VERIFIED |
| `oc/nemotron-3.5-lightning-free` | 128,000 | 64,000 | oc | VERIFIED |
| `oc/nemotron-3.5-super-vl-free` | 128,000 | 64,000 | oc | VERIFIED |

**Alive models with ≥500K context: 16** — `ag` 5, `cx` 3, `gemini` 4, `gh` 2, `oc` 2. Largest context: 1,048,576; largest output: 131,072 (`oc/mimo-v2.6-flash-free`).

### 4.4 Models verified unavailable (60)

| Failure class | Count | Models / examples | Class |
|---|---:|---|---|
| `404 not entitled` (Antigravity account lacks access) | 20 | `ag/claude-opus-5-5*` (4), `ag/claude-sonnet-5-5*` (4), `ag/gemini-3.1-pro*` (2), `ag/gemini-3.6-flash*` (3), `ag/gemini-3.7-flash*` (3), `ag/gemini-4-argon*` (3), `ag/gemini-pro-agent` | UNAVAILABLE |
| `model_not_supported` (plan limitation) | 23 | 13 `gh/*` + 10 `cx/*` (Sol/Astra/Terra/Luna plan-gated variants, Kimi, MAI, Claude Haiku 4.5, GPT-4 legacy, etc.) | UNAVAILABLE |
| `402 Paid Model - Credits Required` | 8 | All `kc/*` (Kilo credits = 0) | UNAVAILABLE |
| `429 quota exceeded` | 4 | `gemini/gemini-4-argon`, `gemini/gemini-3.8-flash`, `gemini/gemini-3.7-flash`, `gemini/gemini-3.1-pro-preview` | UNAVAILABLE (temporary) |
| `Model is unavailable` | 3 | `oc/muse-spark-1.2-contributor-free`, `oc/muse-spark-1.3-contributor-free`, `oc/union-alpha` | UNAVAILABLE |
| `ModelProtocolUnsupported` | 1 | `oc/jev-1.13-free` | UNAVAILABLE |
| `Unsupported model` | 1 | `mmf/mimo-auto` | UNAVAILABLE |

No concurrency or tool-use test was performed; the test verifies **connectivity and basic generation**, not full agentic capability.

---

## 5. 9Router Integration

### 5.1 Service state

| Item | Value | Evidence | Class |
|---|---|---|---|
| Package | `9router` 0.5.112 | `~/.npm-global/lib/node_modules/9router/package.json` | VERIFIED |
| Process | `node /Users/jofi/.npm-global/bin/9router` | `ps aux` | VERIFIED |
| Listener | `TCP *:20128` (IPv4), PID 72241 | `lsof -nP -iTCP:20128 -sTCP:LISTEN` | VERIFIED |
| Health | `GET /api/health` → 200 | `curl -o /dev/null -w '%{http_code}'` | VERIFIED |
| Other health paths | `/health` → 404, `/v1/health` → 404 | same | VERIFIED (not exposed) |
| Catalog | 103 models | `GET /v1/models` | VERIFIED |
| API keys | 2 active (values withheld) | `apiKeys where isActive=1` | VERIFIED |
| Provider connections | 11 active (3 ag, 3 cx, 3 gemini, 1 gh, 1 kc) | `providerConnections` | VERIFIED |
| Combos | 0 rows | `combos` table | VERIFIED (none configured) |
| Provider nodes | 0 rows | `providerNodes` table | VERIFIED (none configured) |
| Usage history | 182 rows, all `status = ok` | `usageHistory` aggregate (credentials column not reproduced) | VERIFIED |
| Daily usage table | 0 rows | `usageDaily` | VERIFIED (empty) |

### 5.2 Endpoint configuration (credentials redacted)

**OpenCode** — `~/.config/opencode/opencode.json`:

```json
{
  "providers": {
    "9router": {
      "name": "9Router (local)",
      "package": "@opencode/ai/providers/openai-compatible",
      "settings": {
        "baseURL": "http://127.0.0.1:20128/v1",
        "apiKey": "<REDACTED>"
      },
      "models": { "...": "43 entries" }
    }
  }
}
```

**Claude Code** — `~/.claude/settings.json`:

| Key | Value |
|---|---|
| `ANTHROPIC_BASE_URL` | `http://127.0.0.1:20128/v1` |
| `ANTHROPIC_AUTH_TOKEN` | `<REDACTED>` |
| `ANTHROPIC_DEFAULT_FABLE_MODEL` | `gh/gpt-5.4-nano` |
| `ANTHROPIC_DEFAULT_OPUS_MODEL` | `gh/gpt-5.4-nano` |
| `ANTHROPIC_DEFAULT_SONNET_MODEL` | `gh/gpt-4.1` |
| `ANTHROPIC_DEFAULT_HAIKU_MODEL` | `ag/gemini-3.8-flash-low` |
| `CLAUDE_CODE_AUTO_MODE_SERVER` | `0` |

**Codex profile** — `~/.codex/ag.config.toml`:

```toml
model = "ag/gemini-3.6-flash-high"
model_provider = "9router"
```

This profile is **broken**: provider `9router` is not declared in Codex's provider registry (`codex exec -p ag` → “Model provider `9router` not found”). The default Codex profile is unaffected and was verified working (`codex exec` → `ok`).

**Direct HTTP** — both routes respond:

- `POST http://127.0.0.1:20128/v1/chat/completions` (OpenAI-compatible)
- `POST http://127.0.0.1:20128/v1/messages` (Anthropic-compatible)

### 5.3 Available model routes

| Route surface | Count | Class |
|---|---:|---|
| 9Router catalog (all prefixes) | 103 | VERIFIED |
| OpenCode configured | 43 | VERIFIED (matches alive set) |
| Alive now | 43 | VERIFIED |
| Quota-blocked Gemini (not in OpenCode) | 4 | UNAVAILABLE (temporary) |
| Config/catalog mismatch | 0 | VERIFIED |

### 5.4 Successful and failed model tests

- **Successful:** 43 / 103
- **Failed:** 60 / 103 (breakdown in §4.4)
- **Test mode:** one non-streaming generation per model, `max_tokens: 16`, two attempts for ambiguous responses.
- **Not tested:** tool calling, streaming, long-context behavior, image/PDF/audio input, concurrent requests.

### 5.5 Credentials handling

- 9Router API keys, Claude Code auth token, Continue OpenAI key, OAuth tokens, and Codex `auth.json` were **not reproduced** in this document.
- The 9Router SQLite database contains an `apiKey` column in `usageHistory`; that column was read only in aggregate and its values are excluded.
- No environment dump containing secrets was produced.

---

## 6. IDE Configuration

### 6.1 Default model resolution

| IDE | Default AI model | Source of truth | Changeable through verified interface? | Class |
|---|---|---|---|---|
| Antigravity | `gpt-oss-120b-medium` (`MODEL_OPENAI_GPT_OSS_120B_MEDIUM`) | `~/.gemini/antigravity/antigravity_state.pbtxt` → `last_selected_agent_model` | **Yes for CLI sessions:** `agy --model <id>` (flag listed in `agy --help`), enumerated by `agy models`. GUI picker not verified headlessly. | VERIFIED |
| VS Code | `copilot/auto` | `~/Library/Application Support/Code/User/globalStorage/state.vscdb` → `chat.currentLanguageModel.terminal`; `isDefault = true` | State key exists and is writable; UI model picker is the supported interface; `code` CLI has no chat-model command. Headless change mechanism **UNVERIFIED**. | VERIFIED (state) / UNVERIFIED (interface) |
| VS Code — Copilot CLI agent | `claude-haiku-4.5` | `.../Code/User/profiles/builtin/agents/globalStorage/state.vscdb` → `sessions.modelPicker.copilotcli.selectedModelId` | UI only; not verified headlessly. | VERIFIED (state) / UNVERIFIED (interface) |
| Cursor | Main chat model **UNKNOWN**; subagent `explore` = `gemini-4-argon` | `cursor/subagentModelOverrides` in Cursor `state.vscdb` | No CLI; UI only. `cursor.modelCatalogOwnKey.gateEnabled = false`. | UNKNOWN |
| Antigravity IDE | **UNKNOWN** | No independent model key in `Antigravity IDE/User/settings.json` or its `state.vscdb`; no `*state*.pbtxt` under `~/.gemini/antigravity-ide` | Not verified. It may share `~/.gemini/antigravity/antigravity_state.pbtxt` with the Antigravity app, but this is not proven. | UNKNOWN |
| Qoder | `auto` | `~/.qoder/.models/default` → `{"key":"auto",...}` | JSON file is writable, but no documented CLI; UI picker not verified. | VERIFIED (state) / UNVERIFIED (interface) |
| Android Studio | Gemini (service-managed; model ID not exposed) | Gemini plugin descriptor `262.9437.185.2621.16467767` | No user-facing model selector found. | UNKNOWN / UNAVAILABLE |
| Eclipse | None | No AI plugin installed | N/A | UNAVAILABLE |

### 6.2 Specific answers

- **Antigravity default model:** `gpt-oss-120b-medium`. Verified from `last_selected_agent_model: MODEL_OPENAI_GPT_OSS_120B_MEDIUM`; the same model appears in `agy models` as “GPT-OSS 120B (Medium)”. The CLI exposes 6 models total (§1.2). Changeable via `agy --model` for CLI sessions (VERIFIED); GUI selection is UNVERIFIED.
- **VS Code default model:** `copilot/auto`, verified in `state.vscdb`. The separate Copilot CLI agent is set to `claude-haiku-4.5`. Claude Code's aliases are mapped to `gh/gpt-5.4-nano` (Opus/Fable), `gh/gpt-4.1` (Sonnet), and `ag/gemini-3.8-flash-low` (Haiku). Only the Claude Code mapping is changeable through a verified interface (`~/.claude/settings.json` environment variables).
- **Cursor default model:** not discoverable. Only the subagent override (`gemini-4-argon`) is present. `cursor.modelCatalogOwnKey.gateEnabled = false`; no main-chat model key exists in `ItemTable`/`cursorDiskKV`. Classified UNKNOWN, not “none”.
- **Antigravity IDE default model:** not discoverable independently. It has no own `settings.json` model key and no `antigravity_state.pbtxt`. Classified UNKNOWN.

### 6.3 Verified change interfaces summary

| Interface | Scope | Evidence | Class |
|---|---|---|---|
| `agy --model <id>` | Antigravity CLI sessions | Flag present in `agy --help`; 6 IDs from `agy models` | VERIFIED |
| `~/.claude/settings.json` env | Claude Code CLI + extension | Model aliases mapped; `claude -p` succeeded | VERIFIED |
| `~/.config/opencode/opencode.json` | OpenCode | 43-model provider block; `opencode run` succeeded | VERIFIED |
| 9Router HTTP API | Any OpenAI/Anthropic-compatible client | `/v1/models`, `/v1/chat/completions`, `/v1/messages` respond | VERIFIED |
| VS Code UI / state DB | Copilot Chat | `chat.currentLanguageModel.terminal` key exists | UNVERIFIED (UI) |
| Cursor UI | Cursor | No CLI; no model key | UNVERIFIED |
| Antigravity IDE UI | Antigravity IDE | No model key found | UNKNOWN |
| Qoder UI / JSON | Qoder | `~/.qoder/.models/default` writable | UNVERIFIED (UI) |

---

## 7. System Maintenance

### 7.1 DMG cleanup already performed (before this audit)

| Item | Value | Evidence | Class |
|---|---|---|---|
| Cleanup action | 28 items moved to Trash under `Downloads-cleanup-2026-11-05` | Prior session action record | VERIFIED (record) |
| Space moved | 7.60 GB | Sum of 28 item sizes at move time | VERIFIED (record) |
| Trash state now | `~/.Trash` empty; cleanup folder absent | `ls -la ~/.Trash`; `find ~/.Trash -maxdepth 1 -name '*cleanup*'` → none | VERIFIED |
| Downloads size now | 5.9 GB | `du -sh ~/Downloads` | VERIFIED |
| Disk free now | 302 GiB free of 460 GiB | `df -h /` | VERIFIED |

Interpretation: the moved installers have since been permanently deleted by emptying Trash. The prior cleanup is therefore complete; no recovery copy remains. This audit did not delete anything.

### 7.2 Remaining installers in `~/Downloads`

| File | Size | State | Class |
|---|---:|---|---|
| `BlueStacksInstaller_5.21.790.7505_cfc840da23afcd66ae85f7ea3b4df647.pkg` | 982 MB | Installer is newer (5.21.790) than installed BlueStacks (5.21.770); retained as update candidate | VERIFIED |
| `Docker.dmg` | 591 MB | Docker is not installed; installer contains Docker 4.76.0 | VERIFIED |
| `Herd_1.28.0.dmg` | 113 MB | Laravel Herd is not installed; installer 1.28.0 | VERIFIED |
| `ChatGPT.dmg` | 69 MB | ChatGPT desktop is not installed; installer 1.2026.119 | VERIFIED |
| `ChatGPTInstaller.dmg` | 832 KB | Mini installer 0.1.4; retained with ChatGPT.dmg | VERIFIED |

### 7.3 Remaining archives / project data (not installers)

| File | Size | Content | Class |
|---|---:|---|---|
| `artifact.tar` | 1.2 MB | Built PWA (`index.html`, `assets/`, `sw.js`, `manifest.webmanifest`) | VERIFIED |
| `Bookly_v1.0_Documentation.zip` | 40 KB | Product/PRD/architecture docs | VERIFIED |
| `PSEE_Environment_Intelligence_v1.0.zip` | 24 KB | PSEE environment-intelligence specs | VERIFIED |
| `PSEE_AI_Infrastructure_v1.0.zip` | 24 KB | PSEE AI infrastructure specs | VERIFIED |
| `files.zip` | 4 KB | `README.md`, `snake.yml` | VERIFIED |

### 7.4 Largest remaining directory

| Path | Size | Note | Class |
|---|---:|---|---|
| `~/Downloads/flutter/` | 4.1 GB | Flutter SDK; `flutter` and `dart` are not on `PATH` | VERIFIED |

### 7.5 Audit non-interference statement

- No installer was deleted or moved during this audit.
- No configuration file was modified during this audit.
- The only write operation in this audit is the creation of this document.
- Model tests were read-only HTTP requests against the locally running 9Router instance.

---

## 8. Consolidated Findings

### 8.1 Verified strengths

1. **7 IDEs installed** with at least one usable AI path each, except Eclipse.
2. **9Router 0.5.112 is healthy** on `127.0.0.1:20128`; both OpenAI- and Anthropic-compatible routes work.
3. **43 live models** are exposed and exactly **43** are configured in OpenCode — zero configuration drift.
4. **OpenCode, Claude Code, and Codex (default profile)** were each verified end-to-end with a real prompt.
5. **16 live models have ≥500K context**, led by 1,048,576-token Gemini and MiMo routes.
6. **Antigravity's CLI exposes 6 models** and its default is known (`gpt-oss-120b-medium`).
7. **Downloads cleanup** reduced 13 GB to 5.9 GB; Trash is empty; 302 GiB free.

### 8.2 Verified gaps / risks

1. **60 of 103 model routes are unusable** (58%): 20 Antigravity entitlement failures, 23 plan-gated models, 8 Kilocode credit failures, 4 Gemini quota failures, 5 model/protocol failures.
2. **Gemini API free-tier quota is exhausted** for 4 models; they may return when the quota resets.
3. **Antigravity CLI quota is exhausted** (reset ≈ 94 h); the desktop/IDE agent likely shares the same quota.
4. **Codex profile `ag` is broken** (`model_provider = 9router` is not registered). Default Codex works but bypasses 9Router.
5. **Orca runtime is stopped**, so worker orchestration and account APIs are unavailable.
6. **Qoder CLI is not installed**, although the IDE is installed and logged in.
7. **Gemini CLI is absent**; only the IDE companion extension is present.
8. **Continue local config references `qwen2.5:14b`, which is not installed**; only 3 of 5 configured models are locally satisfied.
9. **Cursor’s main default model is not discoverable**; only its `explore` subagent override is known.
10. **Antigravity IDE’s independent default model is not discoverable.**
11. **No numeric rate limits are exposed**; only provider error signals are observable.

### 8.3 Classification counts

| Class | Count |
|---|---:|
| IDE findings `VERIFIED` | 6 of 7 IDEs (Eclipse AI = UNAVAILABLE) |
| CLI entry points executable | 23 of 25 |
| AI agent surfaces registered | 14 of 16 |
| AI agent surfaces verified executable | 3 of 16 |
| Model routes verified alive | 43 of 103 |
| Provider routes verified active | 5 of 7 (kc, mmf blocked) |
| Remaining installer cleanup candidates | 4 (BlueStacks, Docker, Herd, ChatGPT) |

---

## 9. Appendix — Evidence Commands

Representative read-only commands used (all executed on 2026-11-05):

```bash
# Host
sw_vers; uname -m; sysctl -n hw.memsize hw.ncpu; df -h /

# IDE versions and paths
for app in /Applications/*.app; do defaults read "$app/Contents/Info.plist" CFBundleShortVersionString; done

# IDE AI extensions
code --list-extensions --show-versions
cursor --list-extensions --show-versions
antigravity-ide --list-extensions --show-versions

# IDE state (read-only SQLite)
sqlite3 "file:$HOME/Library/Application Support/Code/User/globalStorage/state.vscdb?mode=ro" \
  "select key,value from ItemTable where key like '%model%';"
sqlite3 "file:$HOME/Library/Application Support/Antigravity IDE/User/globalStorage/state.vscdb?mode=ro" \
  "select key,value from ItemTable where key like '%model%';"

# CLI versions
for c in node npm python3 git gh gcloud java javac sqlite3 jq ruby swift opencode claude orca ollama; do
  command -v "$c" && "$c" --version
done

# 9Router service and catalog
lsof -nP -iTCP:20128 -sTCP:LISTEN
curl -s http://127.0.0.1:20128/v1/models
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:20128/api/health

# 9Router provider inventory (credential values excluded)
sqlite3 "file:$HOME/.9router/db/data.sqlite?mode=ro" \
  "select provider, count(*) from providerConnections where isActive=1 group by provider;"
sqlite3 "file:$HOME/.9router/db/data.sqlite?mode=ro" \
  "select provider, count(*) from usageHistory group by provider;"

# Agent execution
opencode run --standalone --model 9router/ag/gemini-3.8-flash-low "Reply with exactly: ok"
claude -p "Reply with exactly: ok"
~/.vscode/extensions/openai.chatgpt-26.1021.22027-darwin-arm64/bin/macos-aarch64/codex exec --skip-git-repo-check "Reply with exactly: ok"
~/.gemini/bin/agy -p "Reply with exactly: ok"
orca status
orca agent hooks status

# Antigravity default model and model list
grep last_selected_agent_model ~/.gemini/antigravity/antigravity_state.pbtxt
~/.gemini/bin/agy models

# Maintenance
du -sh ~/Downloads
find ~/.Trash -maxdepth 1 -name '*cleanup*'
find ~/Downloads -maxdepth 1 -type f \( -iname '*.dmg' -o -iname '*.pkg' -o -iname '*.tar*' -o -iname '*.zip' -o -iname '*.exe' \) -exec du -h {} + | sort -hr
```

---

## 10. Limitations

- GUI-only behavior (Copilot Chat, Cursor Composer, Antigravity desktop, Antigravity IDE agent, Qoder agent, Android Studio Gemini) was not exercised; those are `UNVERIFIED`, not assumed functional.
- Model tests covered connectivity and basic text generation only; tool calling, streaming, image/PDF/audio input, and long-context recall were not tested.
- 9Router does not expose numeric RPM/TPM quotas; all rate-limit values are `UNKNOWN` unless a provider error demonstrated a cap.
- Cursor's agent-host SQLite database (`anysphere.cursor-agent-host/data.sqlite`) could not be read through the SQLite CLI (opened as a valid SQLite file but returned no rows), so any model/agent metadata inside it is `UNKNOWN`.
- Antigravity IDE has no independent model preference file; whether it shares the Antigravity app state is `UNVERIFIED`.
- The DMG cleanup is verified from the audit record, current Trash state, Downloads size, and disk free space; the original 28-item list cannot be re-read because Trash was emptied.

---

*End of document.*
