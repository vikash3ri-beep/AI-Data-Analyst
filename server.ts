import 'dotenv/config';
import express from 'express';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import initSqlJs, { type Database } from 'sql.js';
import Papa from 'papaparse';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

let db: Database;

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function initDatabase(): Promise<Database> {
  const SQL = await initSqlJs({
    locateFile: (file) => path.join(__dirname, 'node_modules', 'sql.js', 'dist', file),
  });
  const database = new SQL.Database();

  database.run(`
    CREATE TABLE products (
      product_id INTEGER PRIMARY KEY,
      product_name TEXT NOT NULL,
      category TEXT NOT NULL,
      pricing_tier TEXT NOT NULL,
      unit_price REAL NOT NULL,
      launch_year INTEGER NOT NULL
    );

    CREATE TABLE customers (
      customer_id INTEGER PRIMARY KEY,
      company_name TEXT NOT NULL,
      segment TEXT NOT NULL,
      city TEXT NOT NULL,
      region TEXT NOT NULL,
      signup_date TEXT NOT NULL
    );

    CREATE TABLE sales (
      sale_id INTEGER PRIMARY KEY,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      customer_id INTEGER NOT NULL,
      region TEXT NOT NULL,
      channel TEXT NOT NULL,
      units INTEGER NOT NULL,
      revenue REAL NOT NULL,
      discount_pct REAL NOT NULL,
      order_date TEXT NOT NULL,
      quarter TEXT NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products(product_id),
      FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
    );

    CREATE TABLE marketing_campaigns (
      campaign_id INTEGER PRIMARY KEY,
      channel TEXT NOT NULL,
      campaign_name TEXT NOT NULL,
      spend REAL NOT NULL,
      leads_generated INTEGER NOT NULL,
      conversions INTEGER NOT NULL,
      month TEXT NOT NULL
    );
  `);

  database.run(`
    INSERT INTO products (product_id, product_name, category, pricing_tier, unit_price, launch_year) VALUES
      (1, 'Analytics Pro', 'BI & Analytics', 'Enterprise', 24900, 2022),
      (2, 'DataPilot', 'Automation', 'Growth', 18500, 2023),
      (3, 'InsightX', 'Predictive AI', 'Enterprise', 21000, 2023),
      (4, 'ReportGenie', 'Reporting', 'Starter', 9800, 2021),
      (5, 'Dashboardly', 'Visualization', 'Growth', 12400, 2022),
      (6, 'QueryVault', 'Data Warehouse', 'Enterprise', 28000, 2024);

    INSERT INTO customers (customer_id, company_name, segment, city, region, signup_date) VALUES
      (1, 'Apex FinServe', 'Enterprise', 'Mumbai', 'West', '2023-02-14'),
      (2, 'Kaveri Retail Group', 'Enterprise', 'Bengaluru', 'South', '2023-05-19'),
      (3, 'Indus Logistics', 'Mid-Market', 'Delhi NCR', 'North', '2023-08-03'),
      (4, 'Deccan HealthTech', 'Enterprise', 'Hyderabad', 'South', '2023-11-22'),
      (5, 'Saffron Commerce', 'SMB', 'Pune', 'West', '2024-01-10'),
      (6, 'Narmada Manufacturing', 'Mid-Market', 'Ahmedabad', 'West', '2024-02-18'),
      (7, 'Eastern Grid Energy', 'Enterprise', 'Kolkata', 'East', '2024-03-05'),
      (8, 'Coromandel Foods', 'SMB', 'Chennai', 'South', '2024-04-12'),
      (9, 'Vindhya Telecom', 'Enterprise', 'Jaipur', 'North', '2024-06-08'),
      (10, 'Malabar Exports', 'Mid-Market', 'Kochi', 'South', '2024-07-19');
  `);

  // Curated sales rows so Q2 2024 matches the visual reference totals + multi-quarter trends across 2024-2025
  const salesRows: Array<[number, number, string, number, string, string, number, number, number, string, string]> = [
    // Q2 2024 (2024-04-01 to 2024-06-30) — exact flagship figures
    [1, 1, 'Analytics Pro', 1, 'West', 'Direct Sales', 18, 448200, 5, '2024-04-12', '2024-Q2'],
    [2, 1, 'Analytics Pro', 2, 'South', 'Direct Sales', 16, 398400, 4, '2024-05-08', '2024-Q2'],
    [3, 1, 'Analytics Pro', 4, 'South', 'Partner', 16, 398700, 3, '2024-06-19', '2024-Q2'],
    [4, 2, 'DataPilot', 3, 'North', 'Inbound Web', 18, 333000, 5, '2024-04-21', '2024-Q2'],
    [5, 2, 'DataPilot', 7, 'East', 'Direct Sales', 17, 314500, 2, '2024-05-24', '2024-Q2'],
    [6, 2, 'DataPilot', 6, 'West', 'Partner', 16, 291400, 6, '2024-06-11', '2024-Q2'],
    [7, 3, 'InsightX', 1, 'West', 'Direct Sales', 14, 294000, 0, '2024-04-15', '2024-Q2'],
    [8, 3, 'InsightX', 9, 'North', 'Inbound Web', 12, 252000, 4, '2024-05-19', '2024-Q2'],
    [9, 3, 'InsightX', 2, 'South', 'Direct Sales', 11, 236400, 3, '2024-06-26', '2024-Q2'],
    [10, 4, 'ReportGenie', 5, 'West', 'Self-Serve', 16, 156800, 5, '2024-04-28', '2024-Q2'],
    [11, 4, 'ReportGenie', 8, 'South', 'Self-Serve', 14, 137200, 2, '2024-05-16', '2024-Q2'],
    [12, 4, 'ReportGenie', 3, 'North', 'Inbound Web', 13, 127100, 4, '2024-06-14', '2024-Q2'],
    [13, 5, 'Dashboardly', 6, 'West', 'Self-Serve', 12, 148800, 3, '2024-04-18', '2024-Q2'],
    [14, 5, 'Dashboardly', 10, 'South', 'Partner', 11, 142900, 5, '2024-06-02', '2024-Q2'],

    // Q1 2024
    [15, 1, 'Analytics Pro', 2, 'South', 'Direct Sales', 14, 348600, 4, '2024-01-19', '2024-Q1'],
    [16, 1, 'Analytics Pro', 3, 'North', 'Partner', 12, 298800, 5, '2024-02-22', '2024-Q1'],
    [17, 2, 'DataPilot', 4, 'South', 'Inbound Web', 15, 277500, 3, '2024-01-27', '2024-Q1'],
    [18, 3, 'InsightX', 1, 'West', 'Direct Sales', 10, 210000, 2, '2024-02-14', '2024-Q1'],
    [19, 4, 'ReportGenie', 5, 'West', 'Self-Serve', 19, 186200, 6, '2024-03-08', '2024-Q1'],
    [20, 5, 'Dashboardly', 8, 'South', 'Self-Serve', 13, 161200, 4, '2024-03-21', '2024-Q1'],

    // Q3 2024
    [21, 1, 'Analytics Pro', 7, 'East', 'Direct Sales', 20, 498000, 3, '2024-07-14', '2024-Q3'],
    [22, 1, 'Analytics Pro', 9, 'North', 'Direct Sales', 19, 473100, 4, '2024-08-19', '2024-Q3'],
    [23, 2, 'DataPilot', 2, 'South', 'Inbound Web', 21, 388500, 5, '2024-07-26', '2024-Q3'],
    [24, 3, 'InsightX', 4, 'South', 'Partner', 18, 378000, 2, '2024-08-11', '2024-Q3'],
    [25, 6, 'QueryVault', 1, 'West', 'Direct Sales', 14, 392000, 0, '2024-09-05', '2024-Q3'],
    [26, 4, 'ReportGenie', 10, 'South', 'Self-Serve', 15, 147000, 5, '2024-09-18', '2024-Q3'],
    [27, 5, 'Dashboardly', 5, 'West', 'Inbound Web', 14, 173600, 3, '2024-09-25', '2024-Q3'],

    // Q4 2024
    [28, 1, 'Analytics Pro', 1, 'West', 'Direct Sales', 24, 597600, 5, '2024-10-11', '2024-Q4'],
    [29, 1, 'Analytics Pro', 4, 'South', 'Direct Sales', 22, 547800, 4, '2024-11-19', '2024-Q4'],
    [30, 6, 'QueryVault', 7, 'East', 'Direct Sales', 19, 532000, 3, '2024-12-03', '2024-Q4'],
    [31, 2, 'DataPilot', 9, 'North', 'Partner', 22, 407000, 4, '2024-10-27', '2024-Q4'],
    [32, 3, 'InsightX', 2, 'South', 'Inbound Web', 19, 399000, 2, '2024-11-12', '2024-Q4'],
    [33, 5, 'Dashboardly', 6, 'West', 'Self-Serve', 16, 198400, 4, '2024-12-15', '2024-Q4'],
    [34, 4, 'ReportGenie', 8, 'South', 'Self-Serve', 17, 166600, 5, '2024-12-21', '2024-Q4'],

    // Q1 2025
    [35, 1, 'Analytics Pro', 2, 'South', 'Direct Sales', 26, 647400, 3, '2025-01-16', '2025-Q1'],
    [36, 6, 'QueryVault', 1, 'West', 'Direct Sales', 21, 588000, 2, '2025-02-09', '2025-Q1'],
    [37, 2, 'DataPilot', 3, 'North', 'Inbound Web', 24, 444000, 4, '2025-02-21', '2025-Q1'],
    [38, 3, 'InsightX', 9, 'North', 'Partner', 20, 420000, 3, '2025-03-07', '2025-Q1'],
    [39, 5, 'Dashboardly', 10, 'South', 'Self-Serve', 18, 223200, 5, '2025-03-19', '2025-Q1'],
    [40, 4, 'ReportGenie', 5, 'West', 'Self-Serve', 18, 176400, 4, '2025-03-28', '2025-Q1'],
  ];

  const stmt = database.prepare(
    `INSERT INTO sales (sale_id, product_id, product_name, customer_id, region, channel, units, revenue, discount_pct, order_date, quarter)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const row of salesRows) {
    stmt.run(row);
  }
  stmt.free();

  database.run(`
    INSERT INTO marketing_campaigns (campaign_id, channel, campaign_name, spend, leads_generated, conversions, month) VALUES
      (1, 'Inbound Web', 'Search Intent Q2', 185000, 640, 52, '2024-04'),
      (2, 'Direct Sales', 'Enterprise Outbound', 310000, 280, 68, '2024-05'),
      (3, 'Partner', 'SI Channel Summit', 140000, 210, 39, '2024-06'),
      (4, 'Self-Serve', 'Product-Led Free Trial', 95000, 1120, 74, '2024-06'),
      (5, 'Inbound Web', 'Analytics Benchmark Report', 210000, 780, 61, '2024-09'),
      (6, 'Direct Sales', 'CXO Roundtable Series', 345000, 310, 79, '2024-11'),
      (7, 'Self-Serve', 'Interactive Demo Funnel', 112000, 1340, 88, '2025-01'),
      (8, 'Partner', 'Cloud Marketplace Co-Sell', 165000, 260, 49, '2025-02');
  `);

  return database;
}

interface ColumnInfo {
  name: string;
  type: string;
}

interface TableSchemaInfo {
  name: string;
  rowCount: number;
  columns: ColumnInfo[];
  sampleRows: Record<string, unknown>[];
  isCustom: boolean;
}

const BUILTIN_TABLES = new Set(['products', 'customers', 'sales', 'marketing_campaigns']);

function runSqlSelect(sqlText: string): {
  columns: string[];
  rows: Record<string, unknown>[];
  executionMs: number;
} {
  const cleaned = sqlText.trim().replace(/;+\s*$/, '');
  if (!cleaned) {
    throw new Error('SQL query is empty.');
  }

  // Reject multi-statement queries
  if (cleaned.includes(';')) {
    throw new Error('Only a single read-only SELECT query is permitted.');
  }

  // Strictly permit read-only SELECT or WITH CTEs
  const upper = cleaned.toUpperCase();
  if (!upper.startsWith('SELECT') && !upper.startsWith('WITH')) {
    throw new Error('Only read-only SELECT or WITH queries are permitted.');
  }

  const forbidden = /\b(DROP|DELETE|UPDATE|INSERT|ALTER|CREATE|REPLACE|TRUNCATE|ATTACH|DETACH|PRAGMA|VACUUM)\b/i;
  if (forbidden.test(cleaned)) {
    throw new Error('Write or schema-modifying SQL keywords are not permitted in query execution.');
  }

  const start = performance.now();
  const resultSets = db.exec(cleaned);
  const executionMs = Math.max(1, Math.round((performance.now() - start) * 100) / 100);

  if (!resultSets.length) {
    return { columns: [], rows: [], executionMs };
  }

  const first = resultSets[0];
  const columns = first.columns;
  const rows = first.values.map((vals) => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => {
      obj[col] = vals[i];
    });
    return obj;
  });

  return { columns, rows, executionMs };
}

function getSchemaOverview(): TableSchemaInfo[] {
  const tablesRes = db.exec(
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;`
  );
  if (!tablesRes.length) return [];

  const tableNames = tablesRes[0].values.map((v) => String(v[0]));
  return tableNames.map((tableName) => {
    const pragmaRes = db.exec(`PRAGMA table_info("${tableName}");`);
    const columns: ColumnInfo[] = pragmaRes.length
      ? pragmaRes[0].values.map((row) => ({
          name: String(row[1]),
          type: String(row[2] || 'TEXT'),
        }))
      : [];

    const countRes = db.exec(`SELECT COUNT(*) FROM "${tableName}";`);
    const rowCount = countRes.length ? Number(countRes[0].values[0][0]) : 0;

    const sample = runSqlSelect(`SELECT * FROM "${tableName}" LIMIT 3`);
    return {
      name: tableName,
      rowCount,
      columns,
      sampleRows: sample.rows,
      isCustom: !BUILTIN_TABLES.has(tableName),
    };
  });
}

function sanitizeIdentifier(raw: string, fallback: string): string {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!cleaned) return fallback;
  const safe = /^[0-9]/.test(cleaned) ? `t_${cleaned}` : cleaned;
  return safe.startsWith('sqlite_') ? `t_${safe}` : safe;
}

function inferColumnType(values: unknown[]): 'INTEGER' | 'REAL' | 'TEXT' {
  const nonEmpty = values.filter((v) => v !== null && v !== undefined && String(v).trim() !== '');
  if (nonEmpty.length === 0) return 'TEXT';
  let allInt = true;
  let allNum = true;
  for (const val of nonEmpty) {
    const str = String(val).replace(/[₹$,%\s]/g, '');
    if (!/^-?\d+$/.test(str)) allInt = false;
    if (str === '' || Number.isNaN(Number(str))) allNum = false;
  }
  if (allInt) return 'INTEGER';
  if (allNum) return 'REAL';
  return 'TEXT';
}

function parseCellValue(val: unknown, colType: 'INTEGER' | 'REAL' | 'TEXT'): string | number | null {
  if (val === null || val === undefined) return null;
  const rawStr = String(val).trim();
  if (rawStr === '') return null;
  if (colType === 'INTEGER') {
    const parsed = parseInt(rawStr.replace(/[₹$,%\s]/g, ''), 10);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (colType === 'REAL') {
    const parsed = parseFloat(rawStr.replace(/[₹$,%\s]/g, ''));
    return Number.isNaN(parsed) ? null : parsed;
  }
  return rawStr;
}

async function generateSqlPlan(
  ai: GoogleGenAI,
  question: string,
  schema: TableSchemaInfo[],
  previousError?: { sql: string; error: string },
  previousContext?: { question: string; sql: string },
  modelName: 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite' = 'gemini-4-hydrogen'
) {
  const schemaText = schema
    .map((t) => {
      const cols = t.columns.map((c) => `${c.name} (${c.type})`).join(', ');
      const sampleJson = JSON.stringify(t.sampleRows.slice(0, 2));
      return `TABLE ${t.name} [${t.rowCount} rows]: ${cols}\n  Sample rows: ${sampleJson}`;
    })
    .join('\n\n');

  const contextGuidance = previousContext
    ? `\nPrevious turn context (use ONLY if the new question is a follow-up referring to "that", "it", "same", "isme", etc.):\nPrior question: "${previousContext.question}"\nPrior SQL:\n${previousContext.sql}`
    : '';

  const errorGuidance = previousError
    ? `\nYour previous SQL attempt failed:\nSQL: ${previousError.sql}\nSQLite Error: ${previousError.error}\nFix the SQL syntax or column/table names carefully.`
    : '';

  const response = await ai.models.generateContent({
    model: modelName,
    contents: `User question: "${question}"

Available SQLite database schema:
${schemaText}
${contextGuidance}
${errorGuidance}

Notes about the data:
- If the user asks about "this quarter" without specifying a date, note that Q2 2024 ('2024-04-01' to '2024-06-30') and 2025-Q1 ('2025-01-01' to '2025-03-31') are in the dataset; prefer the latest quarter in the data (2025-Q1) unless the question specifically references Q2 2024 or overall/all-time.
- Write clean, readable, properly indented SQLite SQL (SELECT or WITH ... SELECT only).
- Alias aggregated numeric columns clearly (e.g., total_revenue, order_count, avg_discount).
- Limit unbounded lists to at most 25 rows unless the user asks for everything.`,
    config: {
      systemInstruction:
        'You are an expert senior SQL data analyst. Translate natural-language questions (in English or Hinglish) into valid, optimized SQLite SELECT queries based strictly on the provided schema.',
      thinkingConfig: {
        thinkingLevel:
          modelName === 'gemini-3.1-flash-lite' ? ThinkingLevel.MINIMAL : ThinkingLevel.LOW,
      },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          intentSummary: {
            type: Type.STRING,
            description: 'One concise plain-English sentence explaining what the AI understood and which tables/metrics it is querying.',
          },
          sql: {
            type: Type.STRING,
            description: 'Valid, formatted SQLite SELECT query with clean line breaks and aliases.',
          },
          recommendedChart: {
            type: Type.STRING,
            description: 'Best visualization type: one of bar, line, donut, table, kpi.',
          },
          xAxisKey: {
            type: Type.STRING,
            description: 'Exact column name from SELECT output to use as category/time label (or empty string if kpi).',
          },
          yAxisKey: {
            type: Type.STRING,
            description: 'Exact column name from SELECT output to use as primary numeric metric.',
          },
          currencyColumns: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Column names in the SELECT output that represent monetary/currency values.',
          },
        },
        required: ['intentSummary', 'sql', 'recommendedChart', 'xAxisKey', 'yAxisKey', 'currencyColumns'],
      },
    },
  });

  const text = (response.text ?? '{}').trim();
  return JSON.parse(text) as {
    intentSummary: string;
    sql: string;
    recommendedChart: 'bar' | 'line' | 'donut' | 'table' | 'kpi';
    xAxisKey: string;
    yAxisKey: string;
    currencyColumns: string[];
  };
}

async function generateDataInsight(
  ai: GoogleGenAI,
  question: string,
  sql: string,
  columns: string[],
  rows: Record<string, unknown>[],
  language: 'en' | 'hinglish' = 'en'
) {
  const previewRows = rows.slice(0, 30);
  const langRule =
    language === 'hinglish'
      ? 'Write headlineInsight and keyTakeaways in natural, clear Hinglish (everyday Hindi-English mix written in Latin script, e.g. "Analytics Pro ne Q2 2024 mein ₹12.45L ka sabse zyada revenue generate kiya"). Keep followUpQuestions concise in English or Hinglish.'
      : 'Write in crisp, executive English.';

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Question asked: "${question}"
Executed SQL:
${sql}

Returned ${rows.length} total rows. Columns: ${columns.join(', ')}
Data sample (up to 30 rows):
${JSON.stringify(previewRows)}`,
    config: {
      systemInstruction: `You are a sharp executive data analyst. Base every number and percentage strictly on the returned SQL rows provided—never invent numbers. Keep insights crisp, actionable, and easy to read on a phone screen. Format INR currency cleanly (e.g., ₹12,45,300 or ₹12.45L) if currency figures are in INR. ${langRule}`,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          headlineInsight: {
            type: Type.STRING,
            description: 'Concise 1-2 sentence executive takeaway grounded strictly in the query result.',
          },
          highlightValue: {
            type: Type.STRING,
            description: 'Single compact hero figure or share percentage from the result (e.g., "33.8%" or "₹6.47L").',
          },
          highlightLabel: {
            type: Type.STRING,
            description: 'Short 2-4 word label for the highlight value (e.g., "Top Revenue Share").',
          },
          keyTakeaways: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '2 to 3 concise bullet findings derived from the returned rows.',
          },
          followUpQuestions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '3 relevant short follow-up questions the user might ask next.',
          },
        },
        required: ['headlineInsight', 'highlightValue', 'highlightLabel', 'keyTakeaways', 'followUpQuestions'],
      },
    },
  });

  const text = (response.text ?? '{}').trim();
  return JSON.parse(text) as {
    headlineInsight: string;
    highlightValue: string;
    highlightLabel: string;
    keyTakeaways: string[];
    followUpQuestions: string[];
  };
}

async function startServer() {
  db = await initDatabase();

  const app = express();
  app.use(express.json({ limit: '25mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/schema', (_req, res) => {
    try {
      const schema = getSchemaOverview();
      res.json({ tables: schema });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load schema.' });
    }
  });

  app.get('/api/tables/:name/preview', (req, res) => {
    try {
      const tableName = sanitizeIdentifier(req.params.name, '');
      const schema = getSchemaOverview();
      if (!schema.some((t) => t.name === tableName)) {
        res.status(404).json({ error: `Table "${req.params.name}" not found.` });
        return;
      }
      const result = runSqlSelect(`SELECT * FROM "${tableName}" LIMIT 50`);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to preview table.' });
    }
  });

  app.post('/api/tables/upload', (req, res) => {
    try {
      const { tableName: rawName, csvText } = (req.body ?? {}) as {
        tableName?: string;
        csvText?: string;
      };
      if (!csvText || typeof csvText !== 'string') {
        res.status(400).json({ error: 'CSV content is required.' });
        return;
      }

      const normalizedCsv = csvText.replace(/^\uFEFF/, '').trim();
      if (!normalizedCsv) {
        res.status(400).json({ error: 'CSV content is empty.' });
        return;
      }

      const parsed = Papa.parse<Record<string, unknown>>(normalizedCsv, {
        header: true,
        skipEmptyLines: 'greedy',
        delimitersToGuess: [',', ';', '\t', '|'],
      });

      if (parsed.errors.length > 0 && parsed.data.length === 0) {
        res.status(400).json({ error: `CSV parse error: ${parsed.errors[0].message}` });
        return;
      }

      const rawHeaders = parsed.meta.fields ?? [];
      if (rawHeaders.length === 0 || parsed.data.length === 0) {
        res.status(400).json({ error: 'CSV must contain a header row and at least 1 data row.' });
        return;
      }

      const tableName = sanitizeIdentifier(rawName || 'uploaded_data', 'uploaded_data');
      if (BUILTIN_TABLES.has(tableName)) {
        res.status(400).json({ error: `Cannot overwrite built-in table "${tableName}". Choose a different name.` });
        return;
      }

      const usedCols = new Set<string>();
      const columns = rawHeaders.map((h, idx) => {
        let col = sanitizeIdentifier(h, `col_${idx + 1}`);
        while (usedCols.has(col)) {
          col = `${col}_${idx + 1}`;
        }
        usedCols.add(col);
        const colValues = parsed.data.slice(0, 5000).map((row) => row[h]);
        return {
          rawHeader: h,
          name: col,
          type: inferColumnType(colValues),
        };
      });

      const placeholders = columns.map(() => '?').join(', ');
      const colList = columns.map((c) => `"${c.name}"`).join(', ');
      const colDefs = columns.map((c) => `"${c.name}" ${c.type}`).join(', ');
      const rowsToInsert = parsed.data.slice(0, 5000);

      db.run('BEGIN TRANSACTION;');
      try {
        db.run(`DROP TABLE IF EXISTS "${tableName}";`);
        db.run(`CREATE TABLE "${tableName}" (${colDefs});`);

        const insertStmt = db.prepare(`INSERT INTO "${tableName}" (${colList}) VALUES (${placeholders});`);
        try {
          for (const row of rowsToInsert) {
            const values = columns.map((c) => parseCellValue(row[c.rawHeader], c.type));
            insertStmt.run(values);
          }
        } finally {
          insertStmt.free();
        }
        db.run('COMMIT;');
      } catch (txErr) {
        try {
          db.run('ROLLBACK;');
        } catch {
          // Ignore rollback failure if no transaction active
        }
        throw txErr;
      }

      const schema = getSchemaOverview();
      res.json({
        tableName,
        insertedRows: rowsToInsert.length,
        tables: schema,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to import CSV.' });
    }
  });

  app.delete('/api/tables/:name', (req, res) => {
    try {
      const tableName = sanitizeIdentifier(req.params.name, '');
      if (BUILTIN_TABLES.has(tableName)) {
        res.status(400).json({ error: 'Built-in demo tables cannot be deleted.' });
        return;
      }
      db.run(`DROP TABLE IF EXISTS "${tableName}";`);
      res.json({ tables: getSchemaOverview() });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete table.' });
    }
  });

function formatGeminiError(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err || 'Analysis failed.');
  const lower = raw.toLowerCase();
  if (lower.includes('429') || lower.includes('resource_exhausted') || lower.includes('quota')) {
    return {
      status: 429,
      message:
        'Gemini API free-tier rate limit reached. Select a billing-enabled API key in Settings > Secrets, or click Edit SQL to run custom SQL queries directly.',
    };
  }
  if (
    lower.includes('403') ||
    lower.includes('permission_denied') ||
    lower.includes('api_key_invalid') ||
    lower.includes('not configured')
  ) {
    return {
      status: 403,
      message: 'Gemini API key is missing or invalid. Please check Settings > Secrets.',
    };
  }
  if (lower.includes('404') || lower.includes('not_found')) {
    return {
      status: 404,
      message: 'Configured Gemini model was unavailable. Please retry.',
    };
  }
  return { status: 500, message: raw };
}

function buildStatisticalInsight(
  columns: string[],
  rows: Record<string, unknown>[],
  yAxisKey: string,
  xAxisKey: string,
  language: 'en' | 'hinglish'
) {
  if (!rows.length) {
    return {
      headlineInsight:
        language === 'hinglish'
          ? 'Is query se koi matching record nahi mila.'
          : 'No matching rows were returned for this query.',
      highlightValue: '0',
      highlightLabel: 'Rows Found',
      keyTakeaways: [],
      followUpQuestions: ['Show overall sales by product', 'Compare revenue by region'],
    };
  }
  const labelCol = xAxisKey && columns.includes(xAxisKey) ? xAxisKey : columns[0];
  const numCol =
    yAxisKey && columns.includes(yAxisKey)
      ? yAxisKey
      : columns.find((c) => c !== labelCol && !Number.isNaN(Number(rows[0]?.[c]))) || columns[columns.length - 1];
  const topLabel = String(rows[0][labelCol] ?? 'Top item');
  const topVal = Number(rows[0][numCol]);
  const total = rows.reduce((sum, r) => sum + (Number(r[numCol]) || 0), 0);
  const share = total > 0 && !Number.isNaN(topVal) ? ((topVal / total) * 100).toFixed(1) : null;
  const formattedVal = !Number.isNaN(topVal)
    ? new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(topVal)
    : String(rows[0][numCol] ?? '');

  return {
    headlineInsight:
      language === 'hinglish'
        ? `${topLabel} sabse aage hai (${numCol.replace(/_/g, ' ')}: ${formattedVal})${share ? `, jo total ka ${share}% share hai.` : '.'}`
        : `${topLabel} leads with ${formattedVal} in ${numCol.replace(/_/g, ' ')}${share ? `, accounting for ${share}% of the total.` : '.'}`,
    highlightValue: share ? `${share}%` : formattedVal,
    highlightLabel: share ? 'Top Share' : numCol.replace(/_/g, ' '),
    keyTakeaways: [
      `Returned ${rows.length} rows across ${columns.length} columns.`,
      total > 0 ? `Combined ${numCol.replace(/_/g, ' ')}: ${new Intl.NumberFormat('en-IN').format(Math.round(total))}.` : `Top entry: ${topLabel}.`,
    ],
    followUpQuestions: [
      'Show quarterly revenue growth from 2024-Q1 to 2025-Q1',
      'Compare marketing spend vs conversions by channel',
      'Top 5 customers by total revenue',
    ],
  };
}

  app.post('/api/analyze', async (req, res) => {
    try {
      const { question, previousContext, language } = req.body as {
        question?: string;
        previousContext?: { question: string; sql: string };
        language?: 'en' | 'hinglish';
      };
      if (!question || !question.trim()) {
        res.status(400).json({ error: 'Please enter a question to analyze.' });
        return;
      }

      const ai = getAiClient();
      const schema = getSchemaOverview();
      let activeModel: 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite' = 'gemini-4-hydrogen';

      let plan;
      try {
        plan = await generateSqlPlan(
          ai,
          question.trim(),
          schema,
          undefined,
          previousContext,
          activeModel
        );
      } catch (err) {
        const formatted = formatGeminiError(err);
        if (formatted.status === 429) {
          activeModel = 'gemini-3.1-flash-lite';
          plan = await generateSqlPlan(
            ai,
            question.trim(),
            schema,
            undefined,
            previousContext,
            activeModel
          );
        } else {
          throw err;
        }
      }

      let queryResult: { columns: string[]; rows: Record<string, unknown>[]; executionMs: number };

      try {
        queryResult = runSqlSelect(plan.sql);
      } catch (firstErr) {
        const msg = firstErr instanceof Error ? firstErr.message : 'SQL execution failed';
        // Automatic 1-step self-healing retry
        plan = await generateSqlPlan(
          ai,
          question.trim(),
          schema,
          { sql: plan.sql, error: msg },
          previousContext,
          activeModel
        );
        queryResult = runSqlSelect(plan.sql);
      }

      const targetLang = language === 'hinglish' ? 'hinglish' : 'en';
      let insight;
      try {
        insight = await generateDataInsight(
          ai,
          question.trim(),
          plan.sql,
          queryResult.columns,
          queryResult.rows,
          targetLang
        );
      } catch {
        insight = buildStatisticalInsight(
          queryResult.columns,
          queryResult.rows,
          plan.yAxisKey,
          plan.xAxisKey,
          targetLang
        );
      }

      res.json({
        question: question.trim(),
        intentSummary: plan.intentSummary,
        sql: plan.sql,
        recommendedChart: plan.recommendedChart,
        xAxisKey: plan.xAxisKey,
        yAxisKey: plan.yAxisKey,
        currencyColumns: plan.currencyColumns,
        columns: queryResult.columns,
        rows: queryResult.rows,
        rowCount: queryResult.rows.length,
        executionMs: queryResult.executionMs,
        insight,
      });
    } catch (err) {
      console.error('Analyze error:', err);
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/execute-sql', async (req, res) => {
    try {
      const { sql, question, language, skipInsight } = req.body as {
        sql?: string;
        question?: string;
        language?: 'en' | 'hinglish';
        skipInsight?: boolean;
      };
      if (!sql || !sql.trim()) {
        res.status(400).json({ error: 'SQL query cannot be empty.' });
        return;
      }

      const queryResult = runSqlSelect(sql);
      let insight = null;

      if (!skipInsight && process.env.GEMINI_API_KEY && queryResult.rows.length > 0) {
        try {
          const ai = getAiClient();
          insight = await generateDataInsight(
            ai,
            question || 'Custom SQL query analysis',
            sql,
            queryResult.columns,
            queryResult.rows,
            language === 'hinglish' ? 'hinglish' : 'en'
          );
        } catch {
          // Non-fatal if insight refresh fails on manual SQL run
        }
      }

      res.json({
        sql: sql.trim(),
        columns: queryResult.columns,
        rows: queryResult.rows,
        rowCount: queryResult.rows.length,
        executionMs: queryResult.executionMs,
        insight,
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'SQL execution failed.' });
    }
  });

  app.use('/api', (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status =
      typeof err === 'object' &&
      err !== null &&
      'status' in err &&
      typeof (err as { status?: unknown }).status === 'number'
        ? (err as { status: number }).status
        : 500;
    const type =
      typeof err === 'object' && err !== null && 'type' in err
        ? String((err as { type?: unknown }).type)
        : '';
    if (status === 413 || type === 'entity.too.large') {
      res.status(413).json({
        error: 'CSV payload is too large. Please keep uploads under 25 MB or 5,000 rows.',
      });
      return;
    }
    res.status(status).json({
      error: err instanceof Error ? err.message : 'Unexpected API error.',
    });
  });

  const httpServer = createServer(app);

  const isProduction =
    process.env.NODE_ENV === 'production' ||
    (process.env.NODE_ENV !== 'development' && process.env.npm_lifecycle_event === 'start');

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: 'spa',
    });
    app.use('/@vite/client', (_req, res, next) => {
      const origEnd = res.end.bind(res);
      res.end = ((chunk?: unknown, ...args: unknown[]) => {
        if (typeof chunk === 'string' || Buffer.isBuffer(chunk)) {
          const text = chunk
            .toString('utf8')
            .replace(
              /const transport = normalizeModuleRunnerTransport\(\(\(\) => \{[\s\S]*?\n\}\)\(\)\);/,
              'const transport = normalizeModuleRunnerTransport({ connect() {}, disconnect() {}, send() {} });'
            );
          if (!res.headersSent) {
            res.setHeader('Content-Length', String(Buffer.byteLength(text, 'utf8')));
          }
          return origEnd(text, ...(args as []));
        }
        return origEnd(chunk, ...(args as []));
      }) as typeof res.end;
      next();
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(
      express.static(distPath, {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('manifest.webmanifest')) {
            res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Cache-Control', 'no-cache');
          } else if (filePath.endsWith('sw.js')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Access-Control-Allow-Origin', '*');
          }
        },
      })
    );
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`AskSQL server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
