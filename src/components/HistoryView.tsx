import React, { useState } from 'react';
import { History, Bookmark, Trash2, ArrowUpRight, Search, FileDown } from 'lucide-react';
import { AnalysisResult } from '../types';

interface HistoryViewProps {
  items: AnalysisResult[];
  onOpenItem: (item: AnalysisResult) => void;
  onTogglePin: (id: string) => void;
  onDeleteItem: (id: string) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  items,
  onOpenItem,
  onTogglePin,
  onDeleteItem,
}) => {
  const [filterText, setFilterText] = useState('');
  const [onlyPinned, setOnlyPinned] = useState(false);

  const filtered = items.filter((item) => {
    if (onlyPinned && !item.pinned) return false;
    if (!filterText.trim()) return true;
    const q = filterText.toLowerCase();
    return (
      item.question.toLowerCase().includes(q) ||
      item.sql.toLowerCase().includes(q) ||
      (item.insight?.headlineInsight || '').toLowerCase().includes(q)
    );
  });

  const handleExportMarkdown = () => {
    if (filtered.length === 0) return;
    const md = [
      '# AskSQL Analytics Report',
      `Generated on ${new Date().toLocaleString()}`,
      '',
      ...filtered.flatMap((item, idx) => [
        `## ${idx + 1}. ${item.question}`,
        item.insight?.headlineInsight ? `**Insight:** ${item.insight.headlineInsight}` : '',
        item.insight?.highlightValue
          ? `**Key Metric:** ${item.insight.highlightValue} (${item.insight.highlightLabel})`
          : '',
        '```sql',
        item.sql,
        '```',
        `Returned ${item.rowCount} rows in ${(item.executionMs / 1000).toFixed(2)}s.`,
        '',
      ]),
    ]
      .filter((line) => line !== '')
      .join('\n');

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `asksql-report-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#111827]">Saved & Recent Queries</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Re-open any previous analysis instantly on your device.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {filtered.length > 0 && (
            <button
              type="button"
              onClick={handleExportMarkdown}
              className="inline-flex items-center gap-1.5 min-h-[38px] px-3 py-1.5 rounded-xl border border-emerald-950/12 bg-white text-xs font-semibold text-[#111827] hover:border-[#0F5132]/35 hover:text-[#0F5132] transition-colors cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5 text-[#0F5132]" />
              <span>Export Report (.md)</span>
            </button>
          )}

          <div className="inline-flex items-center gap-1 p-1 bg-[#EAEFED] rounded-xl">
            <button
              type="button"
              onClick={() => setOnlyPinned(false)}
              className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                !onlyPinned ? 'bg-white text-[#111827]' : 'text-slate-600'
              }`}
            >
              All ({items.length})
            </button>
            <button
              type="button"
              onClick={() => setOnlyPinned(true)}
              className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                onlyPinned ? 'bg-white text-[#0F5132]' : 'text-slate-600'
              }`}
            >
              Pinned ({items.filter((i) => i.pinned).length})
            </button>
          </div>
        </div>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          placeholder="Search questions, SQL, or insights..."
          className="w-full min-h-[44px] pl-10 pr-4 rounded-xl border border-emerald-950/12 bg-white text-sm focus:outline-none focus:border-[#0F5132]"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-emerald-950/10 bg-white p-8 text-center">
          <History className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <div className="text-sm font-medium text-[#111827]">No matching queries yet</div>
          <p className="text-xs text-slate-500 mt-1">
            Ask a question in the Analyze tab and it will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-emerald-950/10 bg-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-[#0F5132]/30 transition-colors"
            >
              <button
                type="button"
                onClick={() => onOpenItem(item)}
                className="text-left flex-1 min-w-0 cursor-pointer"
              >
                <div className="text-sm font-semibold text-[#111827] leading-snug">
                  {item.question}
                </div>
                {item.insight?.headlineInsight && (
                  <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                    {item.insight.headlineInsight}
                  </p>
                )}
                <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-2 tabular-nums">
                  <span>{new Date(item.timestamp).toLocaleString()}</span>
                  <span aria-hidden="true">·</span>
                  <span>{item.rowCount} rows</span>
                  <span aria-hidden="true">·</span>
                  <span>{(item.executionMs / 1000).toFixed(2)}s</span>
                </div>
              </button>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => onTogglePin(item.id)}
                  aria-label="Pin query"
                  className={`min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl border transition-colors cursor-pointer ${
                    item.pinned
                      ? 'bg-emerald-50 border-[#0F5132]/30 text-[#0F5132]'
                      : 'border-emerald-950/10 text-slate-400 hover:text-[#111827]'
                  }`}
                >
                  <Bookmark className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteItem(item.id)}
                  aria-label="Delete query"
                  className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl border border-emerald-950/10 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onOpenItem(item)}
                  className="inline-flex items-center gap-1 min-h-[40px] px-3 rounded-xl bg-[#0F5132] text-white text-xs font-semibold hover:bg-[#146C43] cursor-pointer"
                >
                  <span>Open</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
