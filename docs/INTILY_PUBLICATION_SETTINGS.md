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


## Validation snapshot — 2026-09-03

A live full-collector test returned 216 raw items, 51 qualifying candidates after the 60/100 threshold, with 31 WORLD and 20 RUSSIA candidates before queue capping. The queue rebalance therefore has enough RU inventory to build a 20-item queue with the required 10/10 minimum split.

A production test also exposed and corrected a concrete Cyrillic-data defect in the previous implementation: Russian AI relevance terms and Russian search queries had been stored as mojibake, causing Russian discovery to return zero results and Russian relevance to fail. The current implementation uses native UTF-8 Cyrillic terms and queries.
