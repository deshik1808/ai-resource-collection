# AI Basket — Design Spec

- **Date:** 2026-10-06
- **Owner:** Deshik
- **Status:** Draft, awaiting owner review

## 1. Goal

One place for every AI resource Deshik comes across (skills, tools, prompts, websites) from
YouTube Shorts, GenAI classes and friends' suggestions, so any of them can be **found again fast**.

Retrieval is the point. Building is not. Running cost must be **₹0**.

### Success criteria (checked after one week of real use)

| Measure | Target |
|---|---|
| Share → ✅ reply in Telegram | under 30 s |
| `/find` reply | under 5 s |
| Saved links that are correct (spot-check 10) | 8 or more |
| Inputs lost without a trace | 0 |
| Money spent | ₹0 |

## 2. Scope

**In (v1)**
- Save from phone or laptop by sending a message to a private Telegram bot.
- Three kinds of input: a YouTube link (mostly Shorts), any other link, plain text (a name or a prompt).
- AI extracts every resource mentioned, with name, category, short description and a real link.
- Search with `/find <words>` in Telegram, or filter the Google Sheet.

**Out (v1, add only if missed after real use)**
- Weekly digest / review reminders
- Plain-English AI search
- Backup of the Sheet to GitHub
- Sharing with other people

## 3. How it is used

### Save
1. Share a Short (or any link, or type text) to the bot.
2. Bot replies at once: `⏳ Working on it…`
3. 10–30 s later:
   ```
   ✅ 3 found in this Short
   🧩 Skill · superpowers — brainstorming + TDD workflows for Claude Code · skills.sh/obra/superpowers
   🔧 Tool · NotebookLM — chat with your PDFs · notebooklm.google 🔎
   🔧 Tool · XYZ — ❓ link not found
   ```
   Icons: 🧩 Skill · 🔧 Tool · 💬 Prompt · 🌐 Website. 🔎 = link came from a web search. ❓ = no link found.

Text written next to a link (e.g. `from class, skill at 0:30`) is saved as the note and passed to
the AI as a hint.

### Find
- `/find pdf` → up to 10 rows containing every word, newest first. Category words work as
  filters because category is searched too (`/find skill pdf`).
- More than 10 matches → `…and 7 more. Add a word or open the Sheet.`
- No match → `Nothing for "pdf".`
- `/start` → short help text. During first-time setup only (Config chat ID still empty) it
  also replies with the sender's chat ID, so the bot can be locked to it.
- In the Sheet: frozen header row and a filter on `category`.

## 4. Architecture

Three n8n workflows on Deshik's self-hosted n8n (server/VPS with public HTTPS).

```
Telegram ──▶ [1. Bot] ──(content)──▶ [2. Process] ──▶ Google Sheet
                │                        ▲    │
                ├─ /find ──▶ Sheet       │    └──▶ Telegram reply
                └─ /start               │
[3. Retry, every 6 h] ── pending rows ──┘
```

| Workflow | Trigger | Job |
|---|---|---|
| **1. AI Basket – Bot** | Telegram Trigger (message) | Allow only Deshik's chat ID (setup exception: `/start`, see 3). Route `/start`, `/find`, everything else. Send `⏳`. Call Process. |
| **2. AI Basket – Process** | Execute Workflow Trigger | Input `{chat_id, text, retry_row?}` → readers → link finder → dedupe → save → reply. |
| **3. AI Basket – Retry** | Schedule, every 6 h | Read rows with `status = pending` → call Process with `retry_row` set → Process deletes that row on success, or updates it on failure. |

`retry_row` (the pending row's Sheet row number) makes a retry update the existing row instead
of appending a second pending row for the same video.

Why three: Process is shared by Bot and Retry, and a Telegram bot allows only one webhook, so
the bot trigger lives in exactly one workflow.

### 4.1 AI and search services (all free)

| Job | Service | Why this one |
|---|---|---|
| Watch a YouTube video | **Gemini API, free tier** (Flash model; Pro is paid-only since Apr 2026), key from a Google project with **no billing account** (cannot be charged; over-limit calls fail with 429) | Only free service that takes a YouTube URL directly. One call per video. |
| All text work | **NVIDIA NIM** free API (OpenAI-compatible, ~40 RPM) | Free and not tied to Gemini's shrinking quota. |
| Skill links | **skills.sh** search API | Exact skill page + install command. |
| Tool / website links | **Tavily** free plan (~1,000 searches/month, no card — confirm at signup) | Clean search results built for AI use. |

Model choice on NIM is made at build time: the large instruct model that best follows the JSON
format in tests (e.g. a Llama 3.3 70B or DeepSeek class model).

### 4.2 Process pipeline

1. **Split input.** Find every URL in the text (max 5). Leftover text = `note`.
   No URL → the whole text goes to the text reader.
2. **Normalise URLs.** Strip tracking params (`si`, `utm_*`, `feature`). Convert `youtu.be/ID`
   and `/shorts/ID` to one canonical form for dedupe.
3. **Already processed?** Look up `source_url` in the Sheet (skipped when `retry_row` is set):
   - `status = ok` → reply `Already saved on <date>`, skip this URL.
   - `status = pending` → reply `Already queued, will retry`, skip.
   - `status = check` → process again (re-sharing is a deliberate retry); remove the old
     `check` row on success.
4. **Read** with the matching reader. Every reader returns the same JSON:
   ```json
   {"resources": [{"name": "", "category": "Skill|Tool|Prompt|Website",
                   "description": "1–2 lines: what it is and what it is for",
                   "link_in_source": "", "prompt_text": ""}]}
   ```
   - **YouTube reader** — Gemini, video passed as YouTube URL. Prompt asks for every resource
     said OR shown on screen, any link shown, and full text of any prompt shown.
   - **Page reader** — HTTP GET the page, strip to text (first ~8,000 chars), NIM extracts
     **one** resource: the page itself. `link_in_source` = the shared URL.
   - **Text reader** — NIM decides: names to look up (one resource each) or a prompt
     (`category = Prompt`, `prompt_text` = the full text, `name` = a short title).
5. **Find links** for each resource without a usable link:
   - `link_in_source` present → check it (step 6) → `link_from = source` (video) or `shared` (link sent).
   - `category = Skill` → skills.sh search by name. Accept a result only if its skill name
     equals the searched name (case-insensitive), or contains it as a whole word.
     Otherwise fall through to Tavily. → `link_from = skills.sh`.
   - Otherwise, or skill not found → Tavily search `"<name> <description>"`, top 5 results →
     NIM returns the **index** of the official page or `none`. It is never allowed to write a URL.
     → `link_from = search`.
   - Nothing found → `link = ""`, `link_from = not found`.
   - `category = Prompt` with no link is normal, not "not found".
6. **Check link.** HTTP request (follow redirects, 10 s timeout). Status ≥ 400 → treat as not found.
7. **Dedupe resources.** Skip a resource if the Sheet already has the same normalised `link`
   OR the same lower-cased `name` + `category` (catches one skill saved once via GitHub and
   once via skills.sh). Mention `already saved` in the reply.
8. **Save** one row per resource.
9. **Reply** with the summary (section 3). Prompts show the first 100 chars, never the full text
   (Telegram limit 4,096 chars per message).

## 5. Data — Google Sheet "AI Basket", tab `resources`

| Column | Example | Notes |
|---|---|---|
| `saved_at` | 2026-10-06 14:32 | IST |
| `name` | superpowers | |
| `category` | Skill | Skill / Tool / Prompt / Website, blank for pending |
| `description` | Brainstorming + TDD workflows for Claude Code | 1–2 lines |
| `link` | https://skills.sh/obra/superpowers | blank if not found |
| `link_from` | skills.sh | source / shared / skills.sh / search / not found |
| `prompt_text` | | full prompt, Prompts only |
| `source_url` | https://youtube.com/shorts/abc | canonical; blank for typed text |
| `note` | from class | |
| `status` | ok | ok / pending / check |
| `attempts` | 0 | retries used, pending rows only |

## 6. Errors — nothing is lost silently

| Situation | Behaviour |
|---|---|
| Message not from Deshik's chat ID | Ignored, no reply |
| Gemini 429 (daily quota) | Save `source_url` + note as `status = pending`. Reply `⏸ Saved for later, will retry`. |
| Gemini other error (private, age-restricted, removed video) | Save as `status = check`. Reply `⚠️ Couldn't watch this, saved to check manually`. |
| Retry fails 3 times (`attempts = 3`) | Change to `status = check` |
| Tavily down, or NIM down during link picking | Save resources with what is known, `link_from = not found`. Reply notes it. |
| NIM down during page or text reading | Save the raw input (`source_url` or text in `note`) with `status = check`, ⚠️ reply |
| Page fetch fails (page reader) | Save the link with the domain as name, `status = check` |
| Google Sheet write fails | Reply `❌ Not saved, send again` |
| Reader returns zero resources | Reply `Nothing found in this one`; save `source_url` with `status = check` |

**Rule for the user:** no ✅, ⏸ or ⚠️ reply means it was not saved.

## 7. Configuration and secrets

- One **Config** (Set) node at the top of each workflow: allowed chat ID, Sheet ID, model names.
- Credentials live only in n8n. Never in the repo, never in chat.

| Credential | State |
|---|---|
| Telegram — **new** bot from @BotFather | To create (Deshik). The existing bots keep their own webhooks. |
| Google Sheets | Exists (`Google Sheets account`) |
| Gemini | Exists (`Google Gemini(PaLM) Api account`). Confirm: AI Studio key, project has no billing. |
| NVIDIA NIM | To create (Deshik): key from build.nvidia.com |
| Tavily | To create (Deshik): free account key |

## 8. Repo layout

```
README.md                                   what it is, how to use, setup, limits
n8n/ai-basket-bot.workflow.json             exported workflows (credential names only, no secrets)
n8n/ai-basket-process.workflow.json
n8n/ai-basket-retry.workflow.json
docs/superpowers/specs/2026-10-06-ai-basket-design.md   this file
```

## 9. Testing

**Before switching on** — run each case through the workflows and check the Sheet and the reply:

| # | Input | Expected |
|---|---|---|
| 1 | Short that names a skill | Skill row, skills.sh or GitHub link, link opens |
| 2 | Short that says "comment X for the link" | Resource found by name via search, or ❓ |
| 3 | Short showing a prompt on screen | Prompt row with `prompt_text` filled |
| 4 | GitHub repo link | One row, `link_from = shared` |
| 5 | Typed `superpowers skill` | Skill row with link |
| 6 | Typed long prompt | Prompt row, full text saved |
| 7 | Same Short again | `Already saved on …`, no new rows |
| 8 | `/find` with a match / without | Top results / `Nothing for …` |
| 9 | Message from another Telegram account (chat ID set) | No reply, no row |
| 10 | Private or removed video | `status = check`, ⚠️ reply |
| 11 | Gemini 429 (forced with a fake error) | `status = pending`; Retry run processes it and deletes the pending row |
| 12 | Retry that fails again | Same row, `attempts` + 1; after 3 → `status = check`, no second pending row |

**Link honesty check:** open every link saved during testing. Any made-up link is a bug in step 5.

**After one week:** check the success criteria in section 1.

## 10. To verify at build time

- skills.sh search API shape (blocked from the design sandbox). Fallback: Tavily for skills too.
- Tavily free plan terms (credits, card not required).
- Gemini key's project has no billing; note its current free limits from AI Studio.
- NIM model that best follows the JSON format.
- n8n MCP can create and edit workflows on this instance (instance context showed nothing exposed).
