import initSqlJs, { type Database } from 'sql.js';
import Papa from 'papaparse';
import { TableSchemaInfo, ColumnInfo, AnalysisResult, ChartType, DataInsight } from '../types';

const API_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) ||
  (typeof window !== 'undefined' && localStorage.getItem('GEMINI_API_KEY')) ||
  '';
const BUILTIN_TABLES = new Set(['products', 'customers', 'sales', 'marketing_campaigns']);

let db: Database | null = null;
let initPromise: Promise<Database> | null = null;

async function loadWasmBinary(): Promise<ArrayBuffer> {
  const candidates = ['/sql-wasm.wasm', 'sql-wasm.wasm', './sql-wasm.wasm'];
  for (const url of candidates) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        return await res.arrayBuffer();
      }
    } catch {
      // try next candidate
    }
  }
  throw new Error('Unable to fetch sql-wasm.wasm');
}

export async function getLocalDatabase(): Promise<Database> {
  if (db) return db;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const wasmBinary = await loadWasmBinary();
      const SQL = await initSqlJs({ wasmBinary });
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

      const salesRows: Array<[number, number, string, number, string, string, number, number, number, string, string]> = [
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
        [15, 1, 'Analytics Pro', 2, 'South', 'Direct Sales', 14, 348600, 4, '2024-01-19', '2024-Q1'],
        [16, 1, 'Analytics Pro', 3, 'North', 'Partner', 12, 298800, 5, '2024-02-22', '2024-Q1'],
        [17, 2, 'DataPilot', 4, 'South', 'Inbound Web', 15, 277500, 3, '2024-01-27', '2024-Q1'],
        [18, 3, 'InsightX', 1, 'West', 'Direct Sales', 10, 210000, 2, '2024-02-14', '2024-Q1'],
        [19, 4, 'ReportGenie', 5, 'West', 'Self-Serve', 19, 186200, 6, '2024-03-08', '2024-Q1'],
        [20, 5, 'Dashboardly', 8, 'South', 'Self-Serve', 13, 161200, 4, '2024-03-21', '2024-Q1'],
        [21, 1, 'Analytics Pro', 7, 'East', 'Direct Sales', 20, 498000, 3, '2024-07-14', '2024-Q3'],
        [22, 1, 'Analytics Pro', 9, 'North', 'Direct Sales', 19, 473100, 4, '2024-08-19', '2024-Q3'],
        [23, 2, 'DataPilot', 2, 'South', 'Inbound Web', 21, 388500, 5, '2024-07-26', '2024-Q3'],
        [24, 3, 'InsightX', 4, 'South', 'Partner', 18, 378000, 2, '2024-08-11', '2024-Q3'],
        [25, 6, 'QueryVault', 1, 'West', 'Direct Sales', 14, 392000, 0, '2024-09-05', '2024-Q3'],
        [26, 4, 'ReportGenie', 10, 'South', 'Self-Serve', 15, 147000, 5, '2024-09-18', '2024-Q3'],
        [27, 5, 'Dashboardly', 5, 'West', 'Inbound Web', 14, 173600, 3, '2024-09-25', '2024-Q3'],
        [28, 1, 'Analytics Pro', 1, 'West', 'Direct Sales', 24, 597600, 5, '2024-10-11', '2024-Q4'],
        [29, 1, 'Analytics Pro', 4, 'South', 'Direct Sales', 22, 547800, 4, '2024-11-19', '2024-Q4'],
        [30, 6, 'QueryVault', 7, 'East', 'Direct Sales', 19, 532000, 3, '2024-12-03', '2024-Q4'],
        [31, 2, 'DataPilot', 9, 'North', 'Partner', 22, 407000, 4, '2024-10-27', '2024-Q4'],
        [32, 3, 'InsightX', 2, 'South', 'Inbound Web', 19, 399000, 2, '2024-11-12', '2024-Q4'],
        [33, 5, 'Dashboardly', 6, 'West', 'Self-Serve', 16, 198400, 4, '2024-12-15', '2024-Q4'],
        [34, 4, 'ReportGenie', 8, 'South', 'Self-Serve', 17, 166600, 5, '2024-12-21', '2024-Q4'],
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

      db = database;
      return database;
    } catch (err) {
      initPromise = null;
      throw err;
    }
  })();

  return initPromise;
}

export function localRunSqlSelect(database: Database, sqlText: string): {
  columns: string[];
  rows: Record<string, unknown>[];
  executionMs: number;
} {
  const cleaned = sqlText.trim().replace(/;+\s*$/, '');
  if (!cleaned) throw new Error('SQL query is empty.');
  if (cleaned.includes(';')) throw new Error('Only a single read-only SELECT query is permitted.');

  const upper = cleaned.toUpperCase();
  if (!upper.startsWith('SELECT') && !upper.startsWith('WITH')) {
    throw new Error('Only read-only SELECT or WITH queries are permitted.');
  }

  const forbidden = /\b(DROP|DELETE|UPDATE|INSERT|ALTER|CREATE|REPLACE|TRUNCATE|ATTACH|DETACH|PRAGMA|VACUUM)\b/i;
  if (forbidden.test(cleaned)) {
    throw new Error('Write or schema-modifying SQL keywords are not permitted in query execution.');
  }

  const start = performance.now();
  const resultSets = database.exec(cleaned);
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

export function localGetSchemaOverview(database: Database): TableSchemaInfo[] {
  const tablesRes = database.exec(
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;`
  );
  if (!tablesRes.length) return [];

  const tableNames = tablesRes[0].values.map((v) => String(v[0]));
  const overview: TableSchemaInfo[] = [];

  for (const name of tableNames) {
    const colRes = database.exec(`PRAGMA table_info("${name}");`);
    const columns: ColumnInfo[] = colRes.length
      ? colRes[0].values.map((v) => ({
          name: String(v[1]),
          type: String(v[2] || 'TEXT'),
        }))
      : [];

    let rowCount = 0;
    try {
      const countRes = database.exec(`SELECT COUNT(*) FROM "${name}";`);
      if (countRes.length && countRes[0].values.length) {
        rowCount = Number(countRes[0].values[0][0]) || 0;
      }
    } catch {
      rowCount = 0;
    }

    let sampleRows: Record<string, unknown>[] = [];
    try {
      const sampleRes = database.exec(`SELECT * FROM "${name}" LIMIT 3;`);
      if (sampleRes.length) {
        const sampleCols = sampleRes[0].columns;
        sampleRows = sampleRes[0].values.map((vals) => {
          const obj: Record<string, unknown> = {};
          sampleCols.forEach((c, idx) => {
            obj[c] = vals[idx];
          });
          return obj;
        });
      }
    } catch {
      sampleRows = [];
    }

    overview.push({
      name,
      rowCount,
      columns,
      sampleRows,
      isCustom: !BUILTIN_TABLES.has(name),
    });
  }

  return overview;
}

export async function callGemini(contents: string, systemInstruction: string, schema?: object): Promise<string> {
  const models = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3-flash-preview'];
  let lastError: Error | null = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
      const body: Record<string, unknown> = {
        contents: [{ parts: [{ text: contents }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
      };

      if (schema) {
        body.generationConfig = {
          responseMimeType: 'application/json',
          responseSchema: schema,
        };
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini Error (${model}): ${res.status} ${errText}`);
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error(`Empty response from ${model}`);
      return text;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`Model ${model} failed, trying next...`, err);
    }
  }

  throw lastError || new Error('All Gemini model fallbacks failed.');
}

export async function localAnalyze(
  question: string,
  previousContext?: { question: string; sql: string },
  language: 'en' | 'hinglish' = 'en'
): Promise<AnalysisResult> {
  const database = await getLocalDatabase();
  const schema = localGetSchemaOverview(database);

  const schemaText = schema
    .map((t) => {
      const cols = t.columns.map((c) => `${c.name} (${c.type})`).join(', ');
      const sampleJson = JSON.stringify(t.sampleRows.slice(0, 2));
      return `TABLE ${t.name} [${t.rowCount} rows]: ${cols}\n  Sample rows: ${sampleJson}`;
    })
    .join('\n\n');

  const contextGuidance = previousContext
    ? `\nPrior question: "${previousContext.question}"\nPrior SQL:\n${previousContext.sql}`
    : '';

  const systemInstruction =
    'You are an expert senior SQL data analyst. Translate natural-language questions (in English or Hinglish) into valid, optimized SQLite SELECT queries based strictly on the provided schema.';

  const prompt = `User question: "${question}"\n\nAvailable SQLite database schema:\n${schemaText}${contextGuidance}\n\nNotes:\n- Write clean, valid SQLite SELECT queries.\n- Alias aggregated numeric columns clearly.\n- Return JSON response adhering to schema.`;

  const sqlSchema = {
    type: 'OBJECT',
    properties: {
      intentSummary: { type: 'STRING' },
      sql: { type: 'STRING' },
      recommendedChart: { type: 'STRING', enum: ['bar', 'line', 'donut', 'table', 'kpi'] },
      xAxisKey: { type: 'STRING' },
      yAxisKey: { type: 'STRING' },
      currencyColumns: { type: 'ARRAY', items: { type: 'STRING' } },
    },
    required: ['intentSummary', 'sql', 'recommendedChart', 'xAxisKey', 'yAxisKey', 'currencyColumns'],
  };

  const planText = await callGemini(prompt, systemInstruction, sqlSchema);
  const plan = JSON.parse(planText);

  let queryResult;
  try {
    queryResult = localRunSqlSelect(database, plan.sql);
  } catch (err) {
    // Retry once with error prompt
    const retryPrompt = `${prompt}\n\nPrevious SQL failed:\n${plan.sql}\nError: ${err instanceof Error ? err.message : String(err)}\nFix syntax.`;
    const fixedPlanText = await callGemini(retryPrompt, systemInstruction, sqlSchema);
    const fixedPlan = JSON.parse(fixedPlanText);
    queryResult = localRunSqlSelect(database, fixedPlan.sql);
    plan.sql = fixedPlan.sql;
  }

  let insight: DataInsight | null = null;
  try {
    const insightInstruction =
      language === 'hinglish'
        ? 'Write headlineInsight and keyTakeaways in natural, clear Hinglish (Latin script). Keep followUpQuestions concise.'
        : 'Write in crisp, executive English.';

    const insightPrompt = `Question: "${question}"\nSQL: ${plan.sql}\nColumns: ${JSON.stringify(queryResult.columns)}\nRows: ${JSON.stringify(queryResult.rows.slice(0, 20))}`;

    const insightSchema = {
      type: 'OBJECT',
      properties: {
        headlineInsight: { type: 'STRING' },
        highlightValue: { type: 'STRING' },
        highlightLabel: { type: 'STRING' },
        keyTakeaways: { type: 'ARRAY', items: { type: 'STRING' } },
        followUpQuestions: { type: 'ARRAY', items: { type: 'STRING' } },
      },
      required: ['headlineInsight', 'highlightValue', 'highlightLabel', 'keyTakeaways', 'followUpQuestions'],
    };

    const insightText = await callGemini(insightPrompt, insightInstruction, insightSchema);
    insight = JSON.parse(insightText);
  } catch {
    const topVal = queryResult.rows[0]?.[plan.yAxisKey] || 'N/A';
    insight = {
      headlineInsight: `${queryResult.rows[0]?.[plan.xAxisKey] || 'Leader'} leads with ${topVal}.`,
      highlightValue: String(topVal),
      highlightLabel: String(plan.yAxisKey).replace(/_/g, ' '),
      keyTakeaways: [`Returned ${queryResult.rows.length} rows across ${queryResult.columns.length} columns.`],
      followUpQuestions: ['Show quarterly sales growth', 'Top customers by total revenue'],
    };
  }

  return {
    id: `res_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
    question: question.trim(),
    intentSummary: plan.intentSummary || 'Query executed',
    sql: plan.sql,
    recommendedChart: (plan.recommendedChart as ChartType) || 'bar',
    xAxisKey: plan.xAxisKey || (queryResult.columns[0] ?? ''),
    yAxisKey: plan.yAxisKey || (queryResult.columns[1] ?? ''),
    currencyColumns: plan.currencyColumns || [],
    columns: queryResult.columns,
    rows: queryResult.rows,
    rowCount: queryResult.rows.length,
    executionMs: queryResult.executionMs,
    insight,
  };
}
