import React, { useState, useRef, useEffect } from 'react';
import Papa from 'papaparse';
import { Table2, Upload, Trash2, Database, Sparkles, CheckCircle2, AlertCircle, X, Eye } from 'lucide-react';
import { TableSchemaInfo } from '../types';

interface SchemaExplorerProps {
  tables: TableSchemaInfo[];
  onRefreshSchema: () => Promise<void>;
  onAskAboutTable: (question: string) => void;
}

const MAX_UPLOAD_ROWS = 5000;
const LARGE_FILE_THRESHOLD_BYTES = 2 * 1024 * 1024; // 2 MB

async function parseJsonResponse(
  res: Response
): Promise<{ data: Record<string, unknown> | null; rawText: string }> {
  const rawText = await res.text();
  if (!rawText) return { data: null, rawText: '' };
  try {
    return { data: JSON.parse(rawText) as Record<string, unknown>, rawText };
  } catch {
    return { data: null, rawText };
  }
}

function capCsvToMaxRows(
  rawCsv: string,
  maxDataRows = MAX_UPLOAD_ROWS
): { csv: string; truncated: boolean } {
  const clean = rawCsv.replace(/^\uFEFF/, '').trim();
  if (clean.length < 150_000) {
    return { csv: clean, truncated: false };
  }
  const parsed = Papa.parse<string[]>(clean, {
    header: false,
    preview: maxDataRows + 2,
    skipEmptyLines: 'greedy',
    delimitersToGuess: [',', ';', '\t', '|'],
  });
  if (parsed.data.length > maxDataRows + 1) {
    return {
      csv: Papa.unparse(parsed.data.slice(0, maxDataRows + 1)),
      truncated: true,
    };
  }
  return { csv: clean, truncated: false };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const SAMPLE_DATASETS = [
  {
    name: 'monthly_expenses',
    label: 'Personal Expenses (CSV)',
    csv: `month,category,amount,payment_mode,city
2025-01,Rent,24000,UPI,Bengaluru
2025-01,Groceries,8500,Card,Bengaluru
2025-01,Utilities,3200,UPI,Bengaluru
2025-01,Dining Out,4900,UPI,Bengaluru
2025-02,Rent,24000,UPI,Bengaluru
2025-02,Groceries,9100,Card,Bengaluru
2025-02,Travel,11500,Card,Mumbai
2025-02,Utilities,2950,UPI,Bengaluru
2025-03,Rent,24000,UPI,Bengaluru
2025-03,Groceries,8800,UPI,Bengaluru
2025-03,Shopping,6700,Card,Bengaluru`,
  },
  {
    name: 'ecommerce_orders',
    label: 'E-Commerce Orders (CSV)',
    csv: `order_id,category,brand,city,order_value,rating,delivered_days
101,Electronics,Noise,Mumbai,4499,4.5,2
102,Footwear,Campus,Delhi,2199,4.2,3
103,Electronics,boAt,Bengaluru,2999,4.6,1
104,Home Decor,Fabindia,Pune,5600,4.8,4
105,Apparel,Allen Solly,Hyderabad,3499,4.1,3
106,Electronics,OnePlus,Chennai,18999,4.7,2
107,Footwear,Puma,Mumbai,4899,4.4,2`,
  },
];

export const SchemaExplorer: React.FC<SchemaExplorerProps> = ({
  tables,
  onRefreshSchema,
  onAskAboutTable,
}) => {
  const [selectedTable, setSelectedTable] = useState<string>(tables[0]?.name || 'sales');
  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[]>([]);
  const [previewCols, setPreviewCols] = useState<string[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const [showUpload, setShowUpload] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [hasCustomName, setHasCustomName] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [selectedFileLabel, setSelectedFileLabel] = useState<string | null>(null);
  const [readingFile, setReadingFile] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [previewModalTable, setPreviewModalTable] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeTableInfo = tables.find((t) => t.name === selectedTable) || tables[0];
  const modalTableInfo = tables.find((t) => t.name === previewModalTable) || null;

  useEffect(() => {
    if (!previewModalTable) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewModalTable(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [previewModalTable]);

  const loadPreview = async (tableName: string, openModal = false) => {
    setSelectedTable(tableName);
    if (openModal) {
      setPreviewModalTable(tableName);
    }
    setLoadingPreview(true);
    try {
      const res = await fetch(`/api/tables/${encodeURIComponent(tableName)}/preview`, {
        credentials: 'same-origin',
      });
      if (res.ok) {
        const { data } = await parseJsonResponse(res);
        if (data) {
          setPreviewCols((data.columns as string[]) || []);
          setPreviewRows((data.rows as Record<string, unknown>[]) || []);
        }
      }
    } catch {
      // Keep existing sampleRows from schema if preview fetch fails
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploadMessage(null);
    setReadingFile(true);
    setSelectedFileLabel(`${file.name} (${formatBytes(file.size)})`);

    const derivedName = file.name
      .replace(/\.(csv|txt)$/i, '')
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase();

    if (!hasCustomName || !uploadName.trim()) {
      setUploadName(derivedName || 'custom_dataset');
    }

    try {
      if (file.size > LARGE_FILE_THRESHOLD_BYTES) {
        await new Promise<void>((resolve, reject) => {
          Papa.parse<string[]>(file, {
            header: false,
            preview: MAX_UPLOAD_ROWS + 2,
            skipEmptyLines: 'greedy',
            delimitersToGuess: [',', ';', '\t', '|'],
            complete: (results) => {
              const rows = results.data || [];
              if (rows.length < 2) {
                reject(new Error('Selected file has fewer than 2 rows or is not a valid CSV.'));
                return;
              }
              const truncated = rows.length > MAX_UPLOAD_ROWS + 1;
              const cappedRows = rows.slice(0, MAX_UPLOAD_ROWS + 1);
              setCsvText(Papa.unparse(cappedRows));
              if (truncated) {
                setSelectedFileLabel(
                  `${file.name} (${formatBytes(file.size)} — first ${MAX_UPLOAD_ROWS.toLocaleString()} rows loaded)`
                );
              }
              resolve();
            },
            error: (err) => reject(new Error(err.message || 'Could not parse CSV file.')),
          });
        });
      } else {
        const raw = typeof file.text === 'function'
          ? await file.text()
          : await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result || ''));
              reader.onerror = () => reject(new Error('Could not read file from device storage.'));
              reader.readAsText(file);
            });
        const clean = raw.replace(/^\uFEFF/, '');
        if (!clean.trim()) {
          setUploadMessage({ type: 'err', text: 'Selected CSV file is empty.' });
          setCsvText('');
        } else {
          setCsvText(clean);
        }
      }
    } catch (err) {
      setUploadMessage({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to read the selected CSV file.',
      });
    } finally {
      setReadingFile(false);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvText.trim() || readingFile) return;
    setUploading(true);
    setUploadMessage(null);

    try {
      const { csv: preparedCsv, truncated } = capCsvToMaxRows(csvText);
      const res = await fetch('/api/tables/upload', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableName: uploadName.trim() || 'custom_dataset',
          csvText: preparedCsv,
        }),
      });
      const { data, rawText } = await parseJsonResponse(res);
      if (!res.ok) {
        const serverErr =
          (data && typeof data.error === 'string' && data.error) ||
          (rawText && !rawText.trim().startsWith('<') ? rawText.slice(0, 180) : '') ||
          `CSV upload failed (HTTP ${res.status}).`;
        setUploadMessage({ type: 'err', text: serverErr });
        return;
      }

      const importedName = String(data?.tableName || uploadName || 'custom_dataset');
      const insertedRows = Number(data?.insertedRows ?? 0);
      setUploadMessage({
        type: 'ok',
        text: `Imported "${importedName}" (${insertedRows} rows${
          truncated ? `, capped at ${MAX_UPLOAD_ROWS.toLocaleString()}` : ''
        }). Ready to query!`,
      });
      setCsvText('');
      setUploadName('');
      setHasCustomName(false);
      setSelectedFileLabel(null);
      setShowUpload(false);

      try {
        await onRefreshSchema();
        await loadPreview(importedName);
      } catch {
        // Table import succeeded; ignore non-fatal preview refresh hiccup
      }
    } catch (err) {
      const detail =
        !navigator.onLine
          ? 'You appear to be offline. Reconnect to upload a CSV.'
          : err instanceof Error && err.message
          ? `Could not reach upload server (${err.message}). Please retry.`
          : 'Could not reach upload server. Please retry.';
      setUploadMessage({ type: 'err', text: detail });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteTable = async (tableName: string) => {
    try {
      const res = await fetch(`/api/tables/${encodeURIComponent(tableName)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (!res.ok) {
        const { data } = await parseJsonResponse(res);
        setUploadMessage({
          type: 'err',
          text: (data && typeof data.error === 'string' && data.error) || 'Failed to delete table.',
        });
        return;
      }
      await onRefreshSchema();
      setSelectedTable('sales');
      setPreviewRows([]);
    } catch {
      setUploadMessage({ type: 'err', text: 'Failed to delete table due to connection error.' });
    }
  };

  const handleLoadSample = async (sample: (typeof SAMPLE_DATASETS)[number]) => {
    setUploading(true);
    setUploadMessage(null);
    try {
      const res = await fetch('/api/tables/upload', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableName: sample.name, csvText: sample.csv }),
      });
      const { data, rawText } = await parseJsonResponse(res);
      if (!res.ok) {
        const serverErr =
          (data && typeof data.error === 'string' && data.error) ||
          (rawText && !rawText.trim().startsWith('<') ? rawText.slice(0, 180) : '') ||
          `Could not load sample (HTTP ${res.status}).`;
        setUploadMessage({ type: 'err', text: serverErr });
        return;
      }
      const importedName = String(data?.tableName || sample.name);
      const insertedRows = Number(data?.insertedRows ?? 0);
      setUploadMessage({
        type: 'ok',
        text: `Loaded sample table "${importedName}" (${insertedRows} rows). Ready to ask AI!`,
      });
      try {
        await onRefreshSchema();
        await loadPreview(importedName);
      } catch {
        // Non-fatal preview refresh hiccup
      }
    } catch (err) {
      setUploadMessage({
        type: 'err',
        text: err instanceof Error ? `Failed to load sample: ${err.message}` : 'Failed to load sample.',
      });
    } finally {
      setUploading(false);
    }
  };

  const displayCols =
    previewCols.length > 0
      ? previewCols
      : activeTableInfo?.columns.map((c) => c.name) || [];
  const displayRows =
    previewRows.length > 0 && selectedTable === activeTableInfo?.name
      ? previewRows
      : activeTableInfo?.sampleRows || [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#111827]">Database Tables</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Inspect live SQLite tables or upload any CSV file to analyze it instantly with AI.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowUpload(!showUpload);
            setUploadMessage(null);
          }}
          className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl bg-[#0F5132] text-white text-sm font-semibold hover:bg-[#146C43] active:scale-[0.98] transition-all cursor-pointer"
        >
          <Upload className="w-4 h-4" />
          <span>{showUpload ? 'Close Upload' : 'Import CSV Table'}</span>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-slate-500">Quick sample datasets:</span>
        {SAMPLE_DATASETS.map((sample) => {
          const alreadyLoaded = tables.some((t) => t.name === sample.name);
          return (
            <button
              key={sample.name}
              type="button"
              disabled={uploading || alreadyLoaded}
              onClick={() => handleLoadSample(sample)}
              className="min-h-[36px] px-3 py-1.5 rounded-xl border border-emerald-950/12 bg-white text-xs font-medium text-[#111827] hover:border-[#0F5132]/40 hover:text-[#0F5132] disabled:opacity-50 transition-colors cursor-pointer"
            >
              {alreadyLoaded ? `${sample.label} (Loaded)` : `+ Load ${sample.label}`}
            </button>
          );
        })}
      </div>

      {uploadMessage && (
        <div
          className={`flex items-center gap-2.5 p-3.5 rounded-xl border text-sm ${
            uploadMessage.type === 'ok'
              ? 'bg-emerald-50 border-[#0F5132]/20 text-[#0F5132]'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {uploadMessage.type === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{uploadMessage.text}</span>
        </div>
      )}

      {showUpload && (
        <form
          onSubmit={handleUploadSubmit}
          className="rounded-2xl border border-emerald-950/12 bg-white p-4 sm:p-5 space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Table Name
              </label>
              <input
                type="text"
                value={uploadName}
                onChange={(e) => {
                  setUploadName(e.target.value);
                  setHasCustomName(e.target.value.trim().length > 0);
                }}
                placeholder="e.g. monthly_expenses"
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-emerald-950/15 bg-[#F8FAF9] text-sm focus:outline-none focus:border-[#0F5132]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Choose .CSV File
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt,text/csv,text/comma-separated-values,application/csv,application/vnd.ms-excel,text/plain"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                disabled={readingFile || uploading}
                onClick={() => fileInputRef.current?.click()}
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-dashed border-[#0F5132]/40 bg-emerald-50/40 text-sm font-medium text-[#0F5132] hover:bg-emerald-50 disabled:opacity-60 transition-colors cursor-pointer truncate"
              >
                {readingFile
                  ? 'Reading CSV file...'
                  : selectedFileLabel || 'Select CSV File from Device'}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Or Paste CSV Data
            </label>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              rows={5}
              placeholder={'region,month,revenue,orders\nWest,2025-01,185000,24\nSouth,2025-01,240000,31'}
              className="w-full p-3 rounded-xl border border-emerald-950/15 bg-[#F8FAF9] font-mono text-xs focus:outline-none focus:border-[#0F5132]"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="submit"
              disabled={uploading || readingFile || !csvText.trim()}
              className="min-h-[44px] px-5 py-2 rounded-xl bg-[#0F5132] text-white text-sm font-semibold hover:bg-[#146C43] disabled:opacity-50 cursor-pointer"
            >
              {uploading ? 'Creating SQL Table...' : 'Create Table'}
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-4 space-y-2.5">
          {tables.map((tbl) => {
            const active = tbl.name === activeTableInfo?.name;
            return (
              <div
                key={tbl.name}
                className={`rounded-2xl border p-3.5 transition-colors ${
                  active
                    ? 'border-[#0F5132] bg-white'
                    : 'border-emerald-950/10 bg-white/70 hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => loadPreview(tbl.name, true)}
                    className="flex items-center justify-between gap-2.5 text-left min-w-0 flex-1 min-h-[44px] cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          active ? 'bg-[#0F5132] text-white' : 'bg-[#F3F6F4] text-[#0F5132]'
                        }`}
                      >
                        <Table2 className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[#111827] group-hover:text-[#0F5132] truncate transition-colors">
                          {tbl.name}
                        </div>
                        <div className="text-xs text-slate-500 tabular-nums">
                          {tbl.rowCount} rows · {tbl.columns.length} cols
                          {tbl.isCustom ? ' · CSV' : ''}
                        </div>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-[#0F5132] opacity-80 group-hover:opacity-100 shrink-0">
                      <Eye className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Preview</span>
                    </span>
                  </button>

                  {tbl.isCustom && (
                    <button
                      type="button"
                      onClick={() => handleDeleteTable(tbl.name)}
                      aria-label={`Delete ${tbl.name}`}
                      className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {activeTableInfo && (
          <div className="lg:col-span-8 rounded-2xl border border-emerald-950/10 bg-white overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 border-b border-emerald-950/8 bg-[#F8FAF9]">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-[#0F5132]" />
                <span className="text-sm font-bold text-[#111827]">{activeTableInfo.name}</span>
                <span className="text-xs text-slate-500 tabular-nums">
                  · {activeTableInfo.rowCount} rows
                </span>
              </div>

              <button
                type="button"
                onClick={() =>
                  onAskAboutTable(`Summarize key metrics and top performers from ${activeTableInfo.name}`)
                }
                className="inline-flex items-center gap-1.5 min-h-[38px] px-3 py-1.5 rounded-xl bg-[#0F5132] text-white text-xs font-semibold hover:bg-[#146C43] cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Analyze Table</span>
              </button>
            </div>

            <div className="p-4 border-b border-emerald-950/8">
              <div className="text-xs font-semibold text-slate-500 mb-2">Schema Columns</div>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
                {activeTableInfo.columns.map((c) => (
                  <div key={c.name} className="font-mono text-[#111827]">
                    <span>{c.name}</span>
                    <span className="text-slate-400 ml-1">({c.type})</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto clean-scroll">
              {loadingPreview ? (
                <div className="p-6 text-sm text-slate-500">Loading rows...</div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-emerald-950/8 bg-white">
                      {displayCols.map((col) => (
                        <th
                          key={col}
                          className="py-2.5 px-3 font-semibold text-slate-500 whitespace-nowrap"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-950/6">
                    {displayRows.slice(0, 15).map((row, i) => (
                      <tr key={i} className="hover:bg-emerald-50/30">
                        {displayCols.map((col) => (
                          <td
                            key={col}
                            className="py-2 px-3 whitespace-nowrap font-mono text-slate-700 tabular-nums"
                          >
                            {String(row[col] ?? '—')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 5-Row Table Data Preview Modal */}
      {modalTableInfo && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4"
          onClick={() => setPreviewModalTable(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="table-preview-modal-title"
        >
          <div
            className="w-full sm:max-w-3xl rounded-t-3xl sm:rounded-2xl bg-white border border-emerald-950/12 shadow-xl overflow-hidden max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sm:hidden w-10 h-1.5 bg-slate-300 rounded-full mx-auto mt-3" />

            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-emerald-950/10 bg-[#F8FAF9]">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#0F5132] text-white flex items-center justify-center shrink-0">
                  <Table2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3
                    id="table-preview-modal-title"
                    className="text-base font-bold text-[#111827] truncate"
                  >
                    {modalTableInfo.name}
                  </h3>
                  <p className="text-xs text-slate-500 tabular-nums">
                    Showing top 5 of {modalTableInfo.rowCount} rows · {modalTableInfo.columns.length} columns
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPreviewModalTable(null)}
                aria-label="Close table preview"
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-emerald-950/5 hover:text-[#111827] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-auto clean-scroll flex-1">
              {loadingPreview ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  Loading 5-row preview...
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-emerald-950/10 bg-white">
                      <th className="py-2.5 pl-4 pr-2 font-semibold text-slate-400 w-10">#</th>
                      {(previewCols.length > 0
                        ? previewCols
                        : modalTableInfo.columns.map((c) => c.name)
                      ).map((col) => (
                        <th
                          key={col}
                          className="py-2.5 px-3 font-semibold text-slate-600 whitespace-nowrap"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-950/6">
                    {(previewRows.length > 0 && selectedTable === modalTableInfo.name
                      ? previewRows
                      : modalTableInfo.sampleRows
                    )
                      .slice(0, 5)
                      .map((row, idx) => (
                        <tr key={idx} className="hover:bg-emerald-50/40">
                          <td className="py-2.5 pl-4 pr-2 text-slate-400 tabular-nums">
                            {idx + 1}
                          </td>
                          {(previewCols.length > 0
                            ? previewCols
                            : modalTableInfo.columns.map((c) => c.name)
                          ).map((col) => (
                            <td
                              key={col}
                              className="py-2.5 px-3 whitespace-nowrap font-mono text-slate-800 tabular-nums"
                            >
                              {String(row[col] ?? '—')}
                            </td>
                          ))}
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-emerald-950/10 bg-[#F8FAF9]">
              <button
                type="button"
                onClick={() => setPreviewModalTable(null)}
                className="min-h-[44px] px-4 rounded-xl border border-emerald-950/15 bg-white text-sm font-medium text-[#111827] hover:bg-slate-50 cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetName = modalTableInfo.name;
                  setPreviewModalTable(null);
                  onAskAboutTable(`Summarize key metrics and top performers from ${targetName}`);
                }}
                className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl bg-[#0F5132] text-white text-sm font-semibold hover:bg-[#146C43] cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Analyze Table</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
