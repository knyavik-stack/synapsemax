# INTILY Publication Settings

**Single control point:** `scripts/intily_ai_news.py` → `PUBLICATION SETTINGS`.

| Setting | Value | Meaning |
|---|---:|---|
| Search interval | 30 min | Planned news discovery cadence |
| Publication interval | 3 min | Minimum gap between Telegram posts |
| Importance threshold | 60/100 | Minimum candidate importance |
| Max queue | 20 | Maximum qualifying stories in memory |
| RU minimum share | 50% | Minimum RU share when enough RU candidates exist |
| Joke rate | 90% | Target for suitable non-serious posts |
| Urgent queue threshold | 1 | Search immediately at 0–1 queued stories |

## Where to operate

- **Code/settings:** `scripts/intily_ai_news.py`
- **Automation trigger:** Cloudflare Worker `intily-ai-news` → Cron `*/3 * * * *`
- **Publisher workflow:** `.github/workflows/intily-ai-news.yml`
- **Durable candidate state:** `data/intily-ai-news-state.json`
- **Rollback snapshot:** `docs/backups/2026-09-03/`
