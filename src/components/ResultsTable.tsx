import React, { useMemo, useState } from 'react';
import { Download, ArrowUpDown, Check, Search } from 'lucide-react';
import {
  downloadRowsAsCsv,
  formatCellNumber,
  isLikelyCurrencyColumn,
} from '../utils/formatters';

interface ResultsTableProps {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  executionMs: number;
  currencyColumns: string[];
}

export const ResultsTable: React.FC<ResultsTableProps> = ({
  columns,
  rows,
  rowCount,
  executionMs,
  currencyColumns,
}) => {
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(false);
  const [exported, setExported] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase();
    return rows.filter((row) =>
      columns.some((col) => String(row[col] ?? '').toLowerCase().includes(q))
    );
  }, [rows, columns, searchQuery]);

  const sortedRows = useMemo(() => {
    if (!sortCol) return filteredRows;
    return [...filteredRows].sort((a, b) => {
      const av = a[sortCol];
      const bv = b[sortCol];
      const an = Number(av);
      const bn = Number(bv);
      if (!Number.isNaN(an) && !Number.isNaN(bn)) {
        return sortAsc ? an - bn : bn - an;
      }
      return sortAsc
        ? String(av ?? '').localeCompare(String(bv ?? ''))
        : String(bv ?? '').localeCompare(String(av ?? ''));
    });
  }, [filteredRows, sortCol, sortAsc]);

  const columnSums = useMemo(() => {
    const sums: Record<string, number | null> = {};
    if (sortedRows.length <= 1) return sums;
    for (const col of columns) {
      if (/^(id|.*_id|year|launch_year)$/i.test(col)) {
        sums[col] = null;
        continue;
      }
      let allNumeric = true;
      let total = 0;
      for (const row of sortedRows) {
        const val = row[col];
        if (val === null || val === '' || Number.isNaN(Number(val))) {
          allNumeric = false;
          break;
        }
        total += Number(val);
      }
      sums[col] = allNumeric ? total : null;
    }
    return sums;
  }, [columns, sortedRows]);

  const hasAnySum = Object.values(columnSums).some((v) => v !== null);

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(col);
      setSortAsc(false);
    }
  };

  const handleExportCsv = () => {
    if (sortedRows.length === 0) return;
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    downloadRowsAsCsv(`asksql-results-${stamp}.csv`, columns, sortedRows);
    setExported(true);
    window.setTimeout(() => setExported(false), 2000);
  };

  return (
    <div className="rounded-2xl border border-emerald-950/10 bg-white overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-emerald-950/8 bg-[#F8FAF9]">
        <div className="flex items-center gap-2 text-xs text-slate-500 tabular-nums">
          <h3 className="text-sm font-semibold text-[#111827] mr-1">Query Result</h3>
          <span aria-hidden="true">·</span>
          <span>
            {sortedRows.length === rowCount
              ? `${rowCount} ${rowCount === 1 ? 'row' : 'rows'} returned`
              : `${sortedRows.length} of ${rowCount} rows`}
          </span>
          <span aria-hidden="true">·</span>
          <span>{(executionMs / 1000).toFixed(2)}s</span>
        </div>

        <div className="flex items-center gap-2">
          {rows.length > 4 && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter rows..."
                aria-label="Filter result rows"
                className="min-h-[38px] w-36 sm:w-44 pl-8 pr-2.5 rounded-xl border border-emerald-950/12 bg-white text-xs text-[#111827] placeholder:text-slate-400 focus:outline-none focus:border-[#0F5132]"
              />
            </div>
          )}

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={sortedRows.length === 0}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-1.5 rounded-xl border border-emerald-950/15 bg-white text-xs font-semibold text-[#111827] hover:bg-emerald-50/70 hover:border-[#0F5132]/35 disabled:opacity-45 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {exported ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#0F5132]" />
                <span className="text-[#0F5132]">CSV Downloaded</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5 text-[#0F5132]" />
                <span>Export CSV</span>
              </>
            )}
          </button>
        </div>
      </div>

      {sortedRows.length === 0 ? (
        <div className="p-8 text-center text-sm text-slate-500">
          {rows.length === 0
            ? 'Query executed cleanly and returned 0 matching rows.'
            : 'No rows match your filter text.'}
        </div>
      ) : (
        <div className="overflow-x-auto clean-scroll">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-emerald-950/10 bg-white">
                <th className="py-2.5 pl-4 pr-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider w-10">
                  #
                </th>
                {columns.map((col) => {
                  const isNumeric = !Number.isNaN(Number(rows[0]?.[col]));
                  return (
                    <th
                      key={col}
                      className={`py-2.5 px-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap ${
                        isNumeric ? 'text-right' : 'text-left'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleSort(col)}
                        className="inline-flex items-center gap-1 hover:text-[#111827] cursor-pointer"
                      >
                        <span>{col.replace(/_/g, ' ')}</span>
                        <ArrowUpDown className="w-3 h-3 opacity-50" />
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-950/6 text-sm">
              {sortedRows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-emerald-50/35 transition-colors">
                  <td className="py-2.5 pl-4 pr-2 text-xs text-slate-400 tabular-nums">
                    {rIdx + 1}
                  </td>
                  {columns.map((col) => {
                    const val = row[col];
                    const isNum = val !== null && val !== '' && !Number.isNaN(Number(val));
                    const isCurr = isLikelyCurrencyColumn(col, currencyColumns);
                    return (
                      <td
                        key={col}
                        className={`py-2.5 px-3 whitespace-nowrap ${
                          isNum
                            ? 'text-right font-mono text-[13px] tabular-nums text-[#111827]'
                            : 'text-left font-medium text-[#111827]'
                        }`}
                      >
                        {isNum ? formatCellNumber(val, isCurr) : String(val ?? '—')}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            {hasAnySum && (
              <tfoot>
                <tr className="border-t border-emerald-950/15 bg-[#F8FAF9] text-xs font-semibold text-[#0F5132]">
                  <td className="py-2.5 pl-4 pr-2 uppercase tracking-wider">Sum</td>
                  {columns.map((col) => {
                    const sumVal = columnSums[col];
                    if (sumVal === null || sumVal === undefined) {
                      return <td key={col} className="py-2.5 px-3 text-slate-400">—</td>;
                    }
                    const isCurr = isLikelyCurrencyColumn(col, currencyColumns);
                    return (
                      <td
                        key={col}
                        className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap"
                      >
                        {formatCellNumber(sumVal, isCurr)}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
};
