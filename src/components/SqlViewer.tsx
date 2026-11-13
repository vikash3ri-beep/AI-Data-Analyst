import React, { useState, useEffect } from 'react';
import { Copy, Check, Play, Pencil, RotateCcw, CheckCircle2 } from 'lucide-react';

interface SqlViewerProps {
  sql: string;
  isRunning?: boolean;
  onRunCustomSql: (editedSql: string) => Promise<void>;
}

const SQL_KEYWORDS = new Set([
  'SELECT',
  'FROM',
  'WHERE',
  'AND',
  'OR',
  'GROUP',
  'BY',
  'ORDER',
  'LIMIT',
  'AS',
  'SUM',
  'AVG',
  'COUNT',
  'MIN',
  'MAX',
  'ROUND',
  'JOIN',
  'INNER',
  'LEFT',
  'ON',
  'DESC',
  'ASC',
  'WITH',
  'HAVING',
  'DISTINCT',
  'CASE',
  'WHEN',
  'THEN',
  'ELSE',
  'END',
  'IN',
  'NOT',
  'NULL',
  'IS',
  'BETWEEN',
  'LIKE',
]);

function renderHighlightedSql(sql: string) {
  const lines = sql.split('\n');
  return lines.map((line, lineIdx) => {
    const tokens = line.split(/(\s+|[(),.;]|'[^']*')/g).filter(Boolean);
    return (
      <div key={lineIdx} className="leading-6">
        {tokens.map((token, idx) => {
          const upper = token.toUpperCase();
          if (SQL_KEYWORDS.has(upper)) {
            return (
              <span key={idx} className="text-[#6EE7B7] font-semibold">
                {token}
              </span>
            );
          }
          if (token.startsWith("'") && token.endsWith("'")) {
            return (
              <span key={idx} className="text-[#FCD34D]">
                {token}
              </span>
            );
          }
          if (/^\d+(\.\d+)?$/.test(token)) {
            return (
              <span key={idx} className="text-[#93C5FD]">
                {token}
              </span>
            );
          }
          return (
            <span key={idx} className="text-slate-100">
              {token}
            </span>
          );
        })}
      </div>
    );
  });
}

export const SqlViewer: React.FC<SqlViewerProps> = ({ sql, isRunning = false, onRunCustomSql }) => {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draftSql, setDraftSql] = useState(sql);

  useEffect(() => {
    setDraftSql(sql);
    setIsEditing(false);
  }, [sql]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(isEditing ? draftSql : sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard fallback ignored if blocked
    }
  };

  const handleRun = async () => {
    await onRunCustomSql(draftSql);
    setIsEditing(false);
  };

  return (
    <div className="rounded-2xl border border-emerald-950/10 bg-white overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-emerald-950/8 bg-[#F8FAF9]">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-[#111827]">Generated SQL</h3>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-[#0F5132]">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>Query ready</span>
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {!isEditing ? (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-1.5 min-h-[36px] px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-[#111827] hover:bg-emerald-950/5 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Edit SQL</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setDraftSql(sql);
                setIsEditing(false);
              }}
              className="inline-flex items-center gap-1 min-h-[36px] px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors whitespace-nowrap cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Cancel</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 min-h-[36px] px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-[#111827] hover:bg-emerald-950/5 transition-colors whitespace-nowrap cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#0F5132]" />
                <span className="text-[#0F5132]">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy SQL</span>
              </>
            )}
          </button>

          {isEditing && (
            <button
              type="button"
              disabled={isRunning}
              onClick={handleRun}
              className="inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-lg bg-[#0F5132] text-white text-xs font-semibold hover:bg-[#146C43] disabled:opacity-50 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{isRunning ? 'Running...' : 'Run SQL'}</span>
            </button>
          )}
        </div>
      </div>

      <div className="bg-[#0D1512] p-4 font-mono text-[13px] overflow-x-auto clean-scroll">
        {isEditing ? (
          <textarea
            value={draftSql}
            onChange={(e) => setDraftSql(e.target.value)}
            rows={Math.max(5, draftSql.split('\n').length + 1)}
            spellCheck={false}
            aria-label="Edit SQL query"
            className="w-full bg-transparent text-slate-100 font-mono text-[13px] leading-6 focus:outline-none resize-y"
          />
        ) : (
          <pre className="m-0 whitespace-pre font-mono">{renderHighlightedSql(sql)}</pre>
        )}
      </div>
    </div>
  );
};
