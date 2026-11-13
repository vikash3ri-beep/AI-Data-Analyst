import React, { useMemo, useState } from 'react';
import { BarChart3, TrendingUp, PieChart as PieIcon, Table2, ImageDown, Check } from 'lucide-react';
import { ChartType } from '../types';
import { formatCompactINR, formatCellNumber, isLikelyCurrencyColumn } from '../utils/formatters';

interface SmartChartProps {
  recommendedChart: ChartType;
  xAxisKey: string;
  yAxisKey: string;
  currencyColumns: string[];
  columns: string[];
  rows: Record<string, unknown>[];
  activeChart: ChartType;
  onChangeChart: (chart: ChartType) => void;
}

const EMERALD_PALETTE = [
  '#0F5132',
  '#198754',
  '#20A86B',
  '#4CC38A',
  '#7BD9AC',
  '#A7E8C9',
  '#0B3B24',
];

export const SmartChart: React.FC<SmartChartProps> = ({
  xAxisKey,
  yAxisKey,
  currencyColumns,
  columns,
  rows,
  activeChart,
  onChangeChart,
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [savedPng, setSavedPng] = useState(false);

  const resolvedKeys = useMemo(() => {
    const labelKey =
      xAxisKey && columns.includes(xAxisKey)
        ? xAxisKey
        : columns.find((c) => typeof rows[0]?.[c] === 'string') || columns[0] || '';

    const numKey =
      yAxisKey && columns.includes(yAxisKey)
        ? yAxisKey
        : columns.find((c) => c !== labelKey && !Number.isNaN(Number(rows[0]?.[c]))) ||
          columns[columns.length - 1] ||
          '';

    return { labelKey, numKey };
  }, [xAxisKey, yAxisKey, columns, rows]);

  const isCurrency = isLikelyCurrencyColumn(resolvedKeys.numKey, currencyColumns);

  const chartData = useMemo(() => {
    return rows.slice(0, 12).map((row, index) => ({
      index,
      label: String(row[resolvedKeys.labelKey] ?? `Row ${index + 1}`),
      value: Number(row[resolvedKeys.numKey]) || 0,
    }));
  }, [rows, resolvedKeys]);

  const totalValue = useMemo(
    () => chartData.reduce((acc, item) => acc + Math.max(0, item.value), 0),
    [chartData]
  );

  const maxValue = useMemo(
    () => Math.max(1, ...chartData.map((d) => Math.abs(d.value))),
    [chartData]
  );

  if (rows.length === 0 || !resolvedKeys.numKey) {
    return null;
  }

  const formatVal = (val: number) =>
    isCurrency ? formatCompactINR(val) : formatCellNumber(val, false);

  const formatFullVal = (val: number) => formatCellNumber(val, isCurrency);

  const activePoint =
    selectedIndex !== null && chartData[selectedIndex] ? chartData[selectedIndex] : chartData[0];

  const handleSavePng = () => {
    const canvas = document.createElement('canvas');
    const width = 960;
    const height = 520;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#0F5132';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(resolvedKeys.numKey.replace(/_/g, ' ').toUpperCase(), 48, 56);

    ctx.fillStyle = '#64748B';
    ctx.font = '16px sans-serif';
    ctx.fillText(`AskSQL Analysis · ${chartData.length} items`, 48, 86);

    const padX = 56;
    const baseY = 435;
    const chartW = width - padX * 2;
    const chartH = 290;
    const count = chartData.length;
    const slotW = chartW / count;
    const barW = Math.min(72, slotW * 0.58);

    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(padX, baseY);
    ctx.lineTo(width - padX, baseY);
    ctx.stroke();

    chartData.forEach((item, i) => {
      const h = Math.max(8, (Math.abs(item.value) / maxValue) * chartH);
      const x = padX + i * slotW + (slotW - barW) / 2;
      const y = baseY - h;

      ctx.fillStyle = i === 0 ? '#0F5132' : '#25855A';
      ctx.beginPath();
      ctx.roundRect(x, y, barW, h, [8, 8, 0, 0]);
      ctx.fill();

      ctx.fillStyle = '#0F5132';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(formatVal(item.value), x + barW / 2, y - 10);

      ctx.fillStyle = '#334155';
      ctx.font = '13px sans-serif';
      const shortLabel = item.label.length > 13 ? item.label.slice(0, 12) + '…' : item.label;
      ctx.fillText(shortLabel, x + barW / 2, baseY + 26);
    });

    const link = document.createElement('a');
    link.download = `asksql-chart-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    setSavedPng(true);
    window.setTimeout(() => setSavedPng(false), 1800);
  };

  return (
    <div className="rounded-2xl border border-emerald-950/10 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-[#111827] capitalize">
            {resolvedKeys.numKey.replace(/_/g, ' ')}
          </h3>
          {activePoint && activeChart !== 'table' && activeChart !== 'kpi' && (
            <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
              <span className="font-medium text-[#111827]">{activePoint.label}</span>
              <span aria-hidden="true"> · </span>
              <span className="font-semibold text-[#0F5132]">{formatFullVal(activePoint.value)}</span>
              {totalValue > 0 && (
                <>
                  <span aria-hidden="true"> · </span>
                  <span>{((Math.max(0, activePoint.value) / totalValue) * 100).toFixed(1)}% share</span>
                </>
              )}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSavePng}
            title="Save chart as PNG"
            aria-label="Save chart as PNG"
            className="inline-flex items-center justify-center gap-1 min-h-[38px] px-2.5 rounded-xl border border-emerald-950/12 bg-white text-xs font-medium text-slate-600 hover:text-[#0F5132] hover:bg-emerald-50/60 transition-colors cursor-pointer"
          >
            {savedPng ? (
              <Check className="w-3.5 h-3.5 text-[#0F5132]" />
            ) : (
              <ImageDown className="w-3.5 h-3.5 text-[#0F5132]" />
            )}
            <span className="hidden sm:inline">{savedPng ? 'Saved' : 'PNG'}</span>
          </button>

          <div className="inline-flex items-center gap-1 p-1 bg-[#F3F6F4] rounded-xl border border-emerald-950/8">
            {[
              { id: 'bar' as const, label: 'Bar', icon: BarChart3 },
              { id: 'line' as const, label: 'Trend', icon: TrendingUp },
              { id: 'donut' as const, label: 'Share', icon: PieIcon },
              { id: 'table' as const, label: 'Table', icon: Table2 },
            ].map((mode) => {
              const Icon = mode.icon;
              const selected = activeChart === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => onChangeChart(mode.id)}
                  className={`inline-flex items-center gap-1.5 min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    selected
                      ? 'bg-white text-[#0F5132] shadow-xs'
                      : 'text-slate-600 hover:text-[#111827]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">{mode.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {activeChart === 'table' ? null : activeChart === 'kpi' || rows.length === 1 ? (
        <div className="py-5 px-4 rounded-xl bg-[#F8FAF9] border border-emerald-950/8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              {chartData[0].label}
            </div>
            <div className="text-3xl font-bold text-[#0F5132] tabular-nums mt-1">
              {formatFullVal(chartData[0].value)}
            </div>
          </div>
          <div className="text-xs text-slate-500">Single aggregate result</div>
        </div>
      ) : activeChart === 'bar' ? (
        <div className="w-full">
          <div className="grid grid-cols-12 items-end gap-1.5 sm:gap-2.5 h-48 pt-6 pb-2 border-b border-emerald-950/10">
            {chartData.map((d, i) => {
              const heightPct = Math.max(6, Math.round((Math.abs(d.value) / maxValue) * 100));
              const isSelected = selectedIndex === i || (selectedIndex === null && i === 0);
              return (
                <button
                  key={d.label + i}
                  type="button"
                  onClick={() => setSelectedIndex(i)}
                  style={{ gridColumn: `span ${Math.max(1, Math.floor(12 / chartData.length))} / span ${Math.max(1, Math.floor(12 / chartData.length))}` }}
                  className="group flex flex-col items-center justify-end h-full min-w-0 focus:outline-none cursor-pointer"
                >
                  <span className="text-[10px] font-medium text-slate-500 tabular-nums mb-1 truncate max-w-full">
                    {formatVal(d.value)}
                  </span>
                  <div
                    style={{
                      height: `${heightPct}%`,
                      backgroundColor: isSelected ? '#0F5132' : '#25855A',
                      opacity: isSelected ? 1 : 0.78,
                    }}
                    className="w-full max-w-[38px] rounded-t-md transition-all group-hover:opacity-100"
                  />
                </button>
              );
            })}
          </div>
          <div className="flex items-start justify-between gap-1.5 sm:gap-2.5 pt-2">
            {chartData.map((d, i) => (
              <button
                key={d.label + i}
                type="button"
                onClick={() => setSelectedIndex(i)}
                className={`flex-1 min-w-0 text-center text-[11px] leading-tight truncate cursor-pointer ${
                  (selectedIndex === i || (selectedIndex === null && i === 0))
                    ? 'font-semibold text-[#0F5132]'
                    : 'text-slate-500'
                }`}
                title={d.label}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      ) : activeChart === 'line' ? (
        <div className="w-full">
          <svg viewBox="0 0 600 200" className="w-full h-48 overflow-visible" role="img" aria-label="Trend line chart">
            <defs>
              <linearGradient id="emeraldArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0F5132" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#0F5132" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            {[0.25, 0.5, 0.75, 1].map((frac) => (
              <line
                key={frac}
                x1={24}
                x2={576}
                y1={170 - frac * 140}
                y2={170 - frac * 140}
                stroke="#E2E8F0"
                strokeDasharray="3 3"
              />
            ))}
            {(() => {
              const pts = chartData.map((d, idx) => {
                const x =
                  chartData.length === 1
                    ? 300
                    : 28 + (idx / (chartData.length - 1)) * 544;
                const y = 170 - (Math.max(0, d.value) / maxValue) * 140;
                return { x, y, d, idx };
              });
              const polylineStr = pts.map((p) => `${p.x},${p.y}`).join(' ');
              const areaStr = `28,170 ${polylineStr} ${pts[pts.length - 1].x},170`;
              return (
                <>
                  <polygon points={areaStr} fill="url(#emeraldArea)" />
                  <polyline
                    fill="none"
                    stroke="#0F5132"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={polylineStr}
                  />
                  {pts.map((p) => {
                    const active = selectedIndex === p.idx || (selectedIndex === null && p.idx === 0);
                    return (
                      <g
                        key={p.idx}
                        onClick={() => setSelectedIndex(p.idx)}
                        className="cursor-pointer"
                      >
                        <circle cx={p.x} cy={p.y} r={16} fill="transparent" />
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r={active ? 6 : 4}
                          fill={active ? '#0F5132' : '#FFFFFF'}
                          stroke="#0F5132"
                          strokeWidth="2.5"
                        />
                      </g>
                    );
                  })}
                </>
              );
            })()}
          </svg>
          <div className="flex items-center justify-between gap-2 pt-1 text-[11px] text-slate-500">
            {chartData.map((d, i) => (
              <button
                key={d.label + i}
                type="button"
                onClick={() => setSelectedIndex(i)}
                className={`truncate cursor-pointer ${
                  selectedIndex === i ? 'font-semibold text-[#0F5132]' : ''
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-6 py-2">
          <svg viewBox="0 0 180 180" className="w-40 h-40 shrink-0" role="img" aria-label="Share breakdown donut chart">
            {(() => {
              let cumulative = 0;
              const radius = 64;
              const circumference = 2 * Math.PI * radius;
              return chartData.slice(0, 7).map((d, i) => {
                const share = totalValue > 0 ? Math.max(0, d.value) / totalValue : 0;
                const dash = share * circumference;
                const offset = -cumulative * circumference;
                cumulative += share;
                return (
                  <circle
                    key={d.label + i}
                    cx="90"
                    cy="90"
                    r={radius}
                    fill="transparent"
                    stroke={EMERALD_PALETTE[i % EMERALD_PALETTE.length]}
                    strokeWidth={selectedIndex === i ? 26 : 22}
                    strokeDasharray={`${dash} ${circumference}`}
                    strokeDashoffset={offset}
                    transform="rotate(-90 90 90)"
                    onClick={() => setSelectedIndex(i)}
                    className="cursor-pointer transition-all"
                  />
                );
              });
            })()}
            <text
              x="90"
              y="86"
              textAnchor="middle"
              className="fill-[#111827] text-[14px] font-bold tabular-nums"
            >
              {formatVal(activePoint ? activePoint.value : totalValue)}
            </text>
            <text
              x="90"
              y="104"
              textAnchor="middle"
              className="fill-slate-500 text-[10px]"
            >
              {activePoint ? activePoint.label.slice(0, 14) : 'Total'}
            </text>
          </svg>

          <div className="w-full grid grid-cols-1 gap-1.5">
            {chartData.slice(0, 7).map((d, i) => {
              const pct = totalValue > 0 ? ((Math.max(0, d.value) / totalValue) * 100).toFixed(1) : '0.0';
              return (
                <button
                  key={d.label + i}
                  type="button"
                  onClick={() => setSelectedIndex(i)}
                  className={`flex items-center justify-between gap-3 px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                    selectedIndex === i ? 'bg-emerald-50/80' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-xs shrink-0"
                      style={{ backgroundColor: EMERALD_PALETTE[i % EMERALD_PALETTE.length] }}
                    />
                    <span className="truncate font-medium text-[#111827]">{d.label}</span>
                  </div>
                  <div className="flex items-center gap-2.5 tabular-nums shrink-0 text-slate-600">
                    <span className="font-semibold text-[#111827]">{formatVal(d.value)}</span>
                    <span className="text-slate-400 w-11 text-right">{pct}%</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
