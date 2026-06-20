# Operations Command Cheatsheet

This file keeps reusable operational commands. Replace placeholder paths, domains, database names, and service names with your own deployment values.

## Database

Connect to MySQL:

```bash
mysql -h DB_HOST -P 3306 -u DB_USER -p DB_NAME
```

Initialize a fresh database:

```bash
mysql -h DB_HOST -P 3306 -u DB_USER -p DB_NAME < sql/schema.sql
```

Apply a migration:

```bash
mysql -h DB_HOST -P 3306 -u DB_USER -p DB_NAME < sql/migrations/2026-05-08_global_events.sql
```

Useful checks:

```sql
SELECT COUNT(*) FROM raw_items WHERE issue_id IS NULL;
SELECT COUNT(*) FROM global_events;
SELECT COUNT(*) FROM global_event_sources;

SELECT id, period_start, status, ready_at
FROM weekly_issues
ORDER BY ready_at DESC, created_at DESC
LIMIT 5;
```

## Backend Jobs

Run from the backend directory with the virtual environment activated:

```bash
cd /opt/ai-pulse/backend
source .venv/bin/activate
```

Daily ranking pipeline:

```bash
python -m app.jobs.daily_rankings
```

Optional insight enrichment:

```bash
python -m app.jobs.enrich_rankings --limit 10
python -m app.jobs.enrich_rankings --limit 10 --force
```

Generate or regenerate the current weekly issue:

```bash
WEEKLY_SOURCE=global_events python -m app.jobs.generate_weekly --force
```

Send a test weekly email:

```bash
python -m app.jobs.send_weekly --test
```

Recalculate global event scores:

```bash
python -m app.jobs.recalculate_global_events --dry-run
python -m app.jobs.recalculate_global_events --apply
```

## Service Management

Restart the API service:

```bash
sudo systemctl restart aipulse-api
sudo systemctl status aipulse-api --no-pager
sudo journalctl -u aipulse-api -n 200 --no-pager
```

Follow logs:

```bash
sudo journalctl -u aipulse-api -f
```

## Frontend Deploy

Build and publish the frontend:

```bash
cd /opt/ai-pulse
npm ci
npm run build
sudo rsync -a --delete dist/ /var/www/aipulse/
sudo nginx -t && sudo systemctl reload nginx
```

Verify the deployed bundle changed:

```bash
grep -o 'assets/index-[^"]*\.js' /var/www/aipulse/index.html
curl -sS https://YOUR_DOMAIN/ | grep -o 'assets/index-[^"]*\.js'
```

## Cron

Use `deploy/crontab.example` as the source of truth. Recommended timezone:

```cron
TZ=Asia/Shanghai
```

Typical cadence:

| Time (UTC+8) | Task |
| --- | --- |
| Daily 02:10 | `daily_rankings` |
| Daily 02:40 | `enrich_rankings` |
| Monday 04:10 | `generate_weekly` |
| Monday 05:00 | `send_weekly` |

## API Smoke Checks

```bash
curl -s "https://YOUR_DOMAIN/api/health"
curl -s "https://YOUR_DOMAIN/api/rankings?range=today&category=all&limit=5"
curl -s "https://YOUR_DOMAIN/api/events/1"
curl -s "https://YOUR_DOMAIN/api/weekly/latest"
curl -s "https://YOUR_DOMAIN/api/archive?limit=10"
```

SPA routes to verify in a browser:

```text
/
/rankings
/events/1
/weekly/latest
/archive
```
