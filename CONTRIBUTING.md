# Contributing to AI Pulse

Thanks for helping improve AI Pulse. Focused bug fixes, source-quality improvements, scoring discussions, tests, and documentation changes are welcome.

## Before opening a change

- Search existing issues before creating a new one.
- Keep pull requests focused on one problem.
- Never commit API keys, database URLs, email credentials, private QR codes, production data, or `.env` files.
- For security-sensitive findings, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.

## Local setup

Frontend:

```bash
npm ci
npm run dev
```

Backend:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt pytest
cp .env.example .env
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

SQLite can be used for local smoke tests. See the root [README](README.md#quick-start) for the minimal environment variables.

## Required checks

Run the same checks used by CI before opening a pull request:

```bash
npm run lint
npm test
npm run build

cd backend
PYTHONPATH=. python -m pytest
```

## Pull requests

Describe what changed, why it matters, how it was tested, and any operational or schema impact. Add regression tests when changing ranking, deduplication, source ingestion, subscription, or weekly-report behavior.
