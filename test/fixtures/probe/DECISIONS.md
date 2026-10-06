# Probe decisions (2026-10-06, n8n server https://n8n.thefoodplate.in)

- skills.sh search: `GET https://skills.sh/api/search?q=<name>` → `{query, searchType, skills:[{id:"owner/repo/skill", source:"owner/repo", skillId, name, installs}]}`. Skill page = `https://skills.sh/<id>`. `/api/skills?search=` → 404. See `skills-sh.json`.
- Link check: `HEAD` with full response + never error. github.com repo → 200, missing repo → 404. See `link-check.json`.
- Gemini: credential `Google Gemini(PaLM) Api account` works. Model `models/gemini-2.5-flash`. Accepts the canonical `https://www.youtube.com/watch?v=<id>` form of a Short. Needs `maxOutputTokens` 8192 (2048 ended at MAX_TOKENS: thinking tokens count). 30–60 s per Short. Output text at `content.parts[].text`, wrapped in a ```json fence. See `gemini-youtube.json`.
- Gemini `models/gemini-flash-latest`: returned 503 "Service unavailable" twice — not used. See `gemini-unavailable.json`.
- Prompt quality: first prompt gave 9 items for a "Top 3 skills" Short (3 right); tightened `src/prompts/youtube.txt` gave exactly the 3 skills.
- NVIDIA NIM: not probed yet — credential `NVIDIA NIM` not created. Model to confirm: `meta/llama-3.3-70b-instruct`.
- Tavily: not probed yet — credential `Tavily` not created.
- Google Sheets: all three existing OAuth credentials fail (one OAuth client deleted, two need reconnect). Sheet not created yet.
