# AskSQL — AI Data Analyst

Mobile-first AI Data Analyst that converts plain English or Hinglish questions into SQL queries, executes them on live SQLite relational databases and custom uploaded CSVs, and generates interactive charts and executive insights.

## Features
- **Natural Language & Hinglish to SQL**: Ask questions in plain English or Hinglish (e.g. *"Kis product ne sabse zyada revenue generate kiya?"*).
- **Self-Healing SQL Generation**: Automatically fixes syntax errors with Gemini models.
- **Interactive D3 Visualizations**: Dynamic bar charts, line graphs, donut charts, and KPI cards.
- **CSV Data Explorer**: Upload your own CSV datasets (up to 5,000 rows) and query them immediately.
- **Executive PDF Export**: 1-click export of data queries, charts, insights, and summary tables.
- **PWA & Mobile Ready**: Full progressive web app with install prompt, offline detection, and mobile guides.

## Running the App

### 1. Environment Configuration
The `.env` file contains your Gemini API key and port:
```env
GEMINI_API_KEY="your-gemini-api-key"
PORT=3000
APP_URL="http://localhost:3000"
```

### 2. Start Server
Run either:
```bash
start_app.bat
```
or via npm:
```bash
npm run dev
```

The application will be accessible at:
[http://localhost:3000](http://localhost:3000)
