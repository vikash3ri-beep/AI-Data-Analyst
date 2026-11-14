import {
  getLocalDatabase,
  localGetSchemaOverview,
  localRunSqlSelect,
  localAnalyze,
  callGemini,
} from './localEngine';
import Papa from 'papaparse';

export function setupApiInterceptor() {
  const originalFetch = window.fetch;

  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    // Detect if we are running natively inside Capacitor / WebView on mobile
    const isCapacitorNative =
      window.location.protocol === 'capacitor:' ||
      window.location.protocol === 'ionic:' ||
      (typeof window !== 'undefined' &&
        !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()) ||
      (window.location.hostname === 'localhost' && !window.location.port);

    if (urlStr.startsWith('/api/') || urlStr.includes('/api/')) {
      // In web browser when port is 3000, try the backend server first
      if (!isCapacitorNative) {
        try {
          const resp = await originalFetch(input, init);
          const ct = resp.headers.get('content-type') || '';
          // If server responded with actual JSON (not HTML fallback)
          if (resp.ok && ct.includes('application/json')) {
            return resp;
          }
        } catch {
          // Server not reachable -> fall through to localEngine
        }
      }

      // Standalone execution via local in-memory SQLite and Gemini API
      try {
        const url = new URL(urlStr, window.location.origin);
        const path = url.pathname;
        const method = (init?.method || 'GET').toUpperCase();
        let body: Record<string, unknown> = {};
        if (init?.body && typeof init.body === 'string') {
          try {
            body = JSON.parse(init.body);
          } catch {
            // non-json body
          }
        }

        const database = await getLocalDatabase();

        if (path === '/api/health') {
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (path === '/api/schema' && method === 'GET') {
          const tables = localGetSchemaOverview(database);
          return new Response(JSON.stringify({ tables }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (path === '/api/analyze' && method === 'POST') {
          const question = String(body.question || '');
          const prevContext = body.previousContext as { question: string; sql: string } | undefined;
          const language = (body.language as 'en' | 'hinglish') || 'en';
          const result = await localAnalyze(question, prevContext, language);
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (path === '/api/execute-sql' && method === 'POST') {
          const sql = String(body.sql || '');
          const queryResult = localRunSqlSelect(database, sql);
          let insight = null;

          if (!body.skipInsight && queryResult.rows.length > 0) {
            try {
              const langRule =
                body.language === 'hinglish'
                  ? 'Write headlineInsight and keyTakeaways in natural, clear Hinglish.'
                  : 'Write in crisp, executive English.';

              const insightPrompt = `Question: "${body.question || 'Custom SQL query'}"\nSQL: ${sql}\nColumns: ${JSON.stringify(queryResult.columns)}\nRows: ${JSON.stringify(queryResult.rows.slice(0, 20))}`;

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

              const insightText = await callGemini(insightPrompt, langRule, insightSchema);
              insight = JSON.parse(insightText);
            } catch {
              // optional insight fallback
            }
          }

          const result = {
            sql,
            columns: queryResult.columns,
            rows: queryResult.rows,
            rowCount: queryResult.rows.length,
            executionMs: queryResult.executionMs,
            insight,
          };
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (path.includes('/preview') && method === 'GET') {
          const match = path.match(/\/api\/tables\/([^/]+)\/preview/);
          if (match) {
            const tableName = decodeURIComponent(match[1]);
            const result = localRunSqlSelect(database, `SELECT * FROM "${tableName}" LIMIT 50`);
            return new Response(JSON.stringify(result), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            });
          }
        }

        if (path === '/api/tables/upload' && method === 'POST') {
          const rawName = String(body.tableName || 'uploaded_data');
          const csvText = String(body.csvText || '').replace(/^\uFEFF/, '').trim();
          const parsed = Papa.parse<Record<string, unknown>>(csvText, {
            header: true,
            skipEmptyLines: 'greedy',
          });

          const rawHeaders = parsed.meta.fields || [];
          const cleanName = rawName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();

          const colDefs = rawHeaders.map((h, i) => `"${h.replace(/"/g, '""') || `col_${i}`}" TEXT`).join(', ');
          database.run(`DROP TABLE IF EXISTS "${cleanName}";`);
          database.run(`CREATE TABLE "${cleanName}" (${colDefs});`);

          const placeholders = rawHeaders.map(() => '?').join(', ');
          const colList = rawHeaders.map((h) => `"${h.replace(/"/g, '""')}"`).join(', ');
          const stmt = database.prepare(`INSERT INTO "${cleanName}" (${colList}) VALUES (${placeholders});`);
          for (const row of parsed.data.slice(0, 5000)) {
            const vals = rawHeaders.map((h) => row[h] ?? null);
            stmt.run(vals);
          }
          stmt.free();

          const tables = localGetSchemaOverview(database);
          return new Response(
            JSON.stringify({
              tableName: cleanName,
              insertedRows: parsed.data.length,
              rowCount: parsed.data.length,
              schema: tables,
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        if (path.startsWith('/api/tables/') && method === 'DELETE') {
          const match = path.match(/\/api\/tables\/([^/]+)/);
          if (match) {
            const tableName = decodeURIComponent(match[1]);
            database.run(`DROP TABLE IF EXISTS "${tableName}";`);
            const tables = localGetSchemaOverview(database);
            return new Response(
              JSON.stringify({ ok: true, deletedTable: tableName, schema: tables }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              }
            );
          }
        }
      } catch (localErr) {
        return new Response(
          JSON.stringify({ error: localErr instanceof Error ? localErr.message : String(localErr) }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }

    return originalFetch(input, init);
  };
}
