import React, { useMemo, useState } from 'react';
import * as d3 from 'd3';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { AnalysisResult } from '../types';
import { formatCellNumber, formatCompactINR, isLikelyCurrencyColumn } from '../utils/formatters';

interface TrendInsightChartProps {
  result: AnalysisResult;
}

interface TimePoint {
  label: string;
  sortKey: number;
  value: number;
  deltaPct: number | null;
}

function parseTimeSortKey(raw: unknown, fallbackIndex: number): number | null {
  if (raw === null || raw === undefined) return null;
  const str = String(raw).trim();
  if (!str) return null;

  // Quarter formats: 2024-Q1, 2024 Q2, Q1 2024
  const qMatch = str.match(/^(\d{4})[-\s]?Q([1-4])$/i) || str.match(/^Q([1-4])[-\s]?(\d{4})$/i);
  if (qMatch) {
    const isYearFirst = qMatch[1].length === 4;
    const year = Number(isYearFirst ? qMatch[1] : qMatch[2]);
    const quarter = Number(isYearFirst ? qMatch[2] : qMatch[1]);
    return new Date(year, (quarter - 1) * 3, 1).getTime();
  }

  // Pure 4-digit year
  if (/^(19|20)\d{2}$/.test(str)) {
    return new Date(Number(str), 0, 1).getTime();
  }

  // ISO date or YYYY-MM
  if (/^\d{4}-\d{2}(-\d{2})?$/.test(str)) {
    const normalized = str.length === 7 ? `${str}-01` : str;
    const ms = Date.parse(normalized);
    if (!Number.isNaN(ms)) return ms;
  }

  // General JS date string (e.g. Jan 2025)
  if (/[a-zA-Z]{3,}\s+\d{4}/.test(str)) {
    const ms = Date.parse(str);
    if (!Number.isNaN(ms)) return ms;
  }

  return fallbackIndex >= 0 ? null : null;
}

export const TrendInsightChart: React.FC<TrendInsightChartProps> = ({ result }) => {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const timeSeries = useMemo(() => {
    const { columns, rows, xAxisKey, yAxisKey, currencyColumns } = result;
    if (rows.length < 2 || columns.length < 2) return null;

    // Detect time-series column by column name or sample value pattern
    const timeCol =
      columns.find((col) =>
        /(date|month|quarter|year|week|day|period|time)/i.test(col)
      ) ||
      columns.find((col) =>
        rows.slice(0, 5).every((r) => parseTimeSortKey(r[col], 0) !== null)
      );

    if (!timeCol) return null;

    const metricCol =
      yAxisKey && columns.includes(yAxisKey) && yAxisKey !== timeCol
        ? yAxisKey
        : columns.find(
            (c) =>
              c !== timeCol &&
              !/^(id|.*_id)$/i.test(c) &&
              rows.every((r) => r[c] !== null && r[c] !== '' && !Number.isNaN(Number(r[c])))
          );

    if (!metricCol) return null;

    // Aggregate duplicate time labels if needed (e.g. multiple products per quarter)
    const grouped = new Map<string, { sortKey: number; sum: number }>();
    rows.forEach((row, idx) => {
      const label = String(row[timeCol] ?? '').trim();
      if (!label) return;
      const val = Number(row[metricCol]);
      if (Number.isNaN(val)) return;
      const parsedTime = parseTimeSortKey(label, idx);
      const sortKey = parsedTime !== null ? parsedTime : idx;
      const existing = grouped.get(label);
      if (existing) {
        existing.sum += val;
      } else {
        grouped.set(label, { sortKey, sum: val });
      }
    });

    if (grouped.size < 2) return null;

    const sorted = Array.from(grouped.entries())
      .map(([label, info]) => ({
        label,
        sortKey: info.sortKey,
        value: info.sum,
      }))
      .sort((a, b) => a.sortKey - b.sortKey);

    const points: TimePoint[] = sorted.map((item, idx) => {
      if (idx === 0) return { ...item, deltaPct: null };
      const prev = sorted[idx - 1].value;
      const deltaPct = prev !== 0 ? ((item.value - prev) / Math.abs(prev)) * 100 : null;
      return { ...item, deltaPct };
    });

    const isCurrency = isLikelyCurrencyColumn(metricCol, currencyColumns);
    const firstVal = points[0].value;
    const lastVal = points[points.length - 1].value;
    const overallPct = firstVal !== 0 ? ((lastVal - firstVal) / Math.abs(firstVal)) * 100 : 0;

    return {
      timeCol,
      metricCol,
      isCurrency,
      points,
      overallPct,
    };
  }, [result]);

  const d3Geometry = useMemo(() => {
    if (!timeSeries) return null;
    const { points } = timeSeries;

    const width = 640;
    const height = 190;
    const margin = { top: 20, right: 24, bottom: 32, left: 56 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const xScale = d3
      .scalePoint<string>()
      .domain(points.map((p) => p.label))
      .range([margin.left, margin.left + innerW])
      .padding(0.15);

    const minVal = d3.min(points, (d) => d.value) ?? 0;
    const maxVal = d3.max(points, (d) => d.value) ?? 1;
    const domainMin = minVal >= 0 ? 0 : minVal * 1.1;
    const domainMax = maxVal === domainMin ? domainMin + 1 : maxVal * 1.12;

    const yScale = d3
      .scaleLinear()
      .domain([domainMin, domainMax])
      .nice()
      .range([margin.top + innerH, margin.top]);

    const lineGen = d3
      .line<TimePoint>()
      .x((d) => xScale(d.label) ?? margin.left)
      .y((d) => yScale(d.value))
      .curve(d3.curveMonotoneX);

    const areaGen = d3
      .area<TimePoint>()
      .x((d) => xScale(d.label) ?? margin.left)
      .y0(yScale(domainMin))
      .y1((d) => yScale(d.value))
      .curve(d3.curveMonotoneX);

    // Linear regression trendline via D3 mean
    const indices = points.map((_, i) => i);
    const xMean = d3.mean(indices) ?? 0;
    const yMean = d3.mean(points, (p) => p.value) ?? 0;
    let num = 0;
    let den = 0;
    points.forEach((p, i) => {
      num += (i - xMean) * (p.value - yMean);
      den += (i - xMean) * (i - xMean);
    });
    const slope = den !== 0 ? num / den : 0;
    const intercept = yMean - slope * xMean;

    const trendStart = {
      x: xScale(points[0].label) ?? margin.left,
      y: yScale(intercept),
    };
    const trendEnd = {
      x: xScale(points[points.length - 1].label) ?? margin.left + innerW,
      y: yScale(intercept + slope * (points.length - 1)),
    };

    const yTicks = yScale.ticks(4);
    const peakPoint = d3.greatest(points, (a, b) => a.value - b.value) || points[0];

    return {
      width,
      height,
      margin,
      xScale,
      yScale,
      yTicks,
      linePath: lineGen(points) || '',
      areaPath: areaGen(points) || '',
      trendStart,
      trendEnd,
      peakPoint,
    };
  }, [timeSeries]);

  if (!timeSeries || !d3Geometry) return null;

  const { points, overallPct, isCurrency, metricCol } = timeSeries;
  const isGrowth = overallPct > 0.5;
  const isDecline = overallPct < -0.5;
  const strokeColor = isDecline ? '#B91C1C' : '#0F5132';
  const fillStopColor = isDecline ? '#DC2626' : '#0F5132';

  const focusedIdx = activeIdx !== null && points[activeIdx] ? activeIdx : points.length - 1;
  const focusedPoint = points[focusedIdx];

  const formatTick = (val: number) =>
    isCurrency ? formatCompactINR(val) : formatCellNumber(val, false);

  return (
    <div className="mt-4 pt-4 border-t border-[#0F5132]/12">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#0F5132]">
              Trend Insight
            </h4>
            <span
              className={`inline-flex items-center gap-1 text-xs font-semibold tabular-nums ${
                isGrowth
                  ? 'text-[#0F5132]'
                  : isDecline
                    ? 'text-red-700'
                    : 'text-slate-600'
              }`}
            >
              {isGrowth ? (
                <TrendingUp className="w-3.5 h-3.5" />
              ) : isDecline ? (
                <TrendingDown className="w-3.5 h-3.5" />
              ) : (
                <Minus className="w-3.5 h-3.5" />
              )}
              <span>
                {overallPct > 0 ? '+' : ''}
                {overallPct.toFixed(1)}% {isDecline ? 'decline' : isGrowth ? 'growth' : 'flat'} ({points[0].label} → {points[points.length - 1].label})
              </span>
            </span>
          </div>

          <p className="text-xs text-slate-600 mt-0.5 tabular-nums">
            <span className="font-medium text-[#111827]">{focusedPoint.label}:</span>{' '}
            <span className="font-semibold text-[#111827]">
              {formatCellNumber(focusedPoint.value, isCurrency)}
            </span>
            {focusedPoint.deltaPct !== null && (
              <>
                <span aria-hidden="true"> · </span>
                <span
                  className={
                    focusedPoint.deltaPct >= 0 ? 'text-[#0F5132] font-medium' : 'text-red-700 font-medium'
                  }
                >
                  {focusedPoint.deltaPct >= 0 ? '+' : ''}
                  {focusedPoint.deltaPct.toFixed(1)}% vs prior
                </span>
              </>
            )}
            <span aria-hidden="true"> · </span>
            <span>
              Peak: {d3Geometry.peakPoint.label} ({formatTick(d3Geometry.peakPoint.value)})
            </span>
          </p>
        </div>

        <span className="text-[11px] font-medium text-slate-500 capitalize">
          {metricCol.replace(/_/g, ' ')} trajectory
        </span>
      </div>

      <div className="rounded-xl bg-white border border-[#0F5132]/10 p-2 sm:p-3">
        <svg
          viewBox={`0 0 ${d3Geometry.width} ${d3Geometry.height}`}
          className="w-full h-44 sm:h-48 overflow-visible"
          role="img"
          aria-label="D3 historical trend insight chart"
        >
          <defs>
            <linearGradient id="d3TrendArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={fillStopColor} stopOpacity="0.18" />
              <stop offset="100%" stopColor={fillStopColor} stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Horizontal Y gridlines & labels */}
          {d3Geometry.yTicks.map((tick) => {
            const ty = d3Geometry.yScale(tick);
            return (
              <g key={tick}>
                <line
                  x1={d3Geometry.margin.left}
                  x2={d3Geometry.width - d3Geometry.margin.right}
                  y1={ty}
                  y2={ty}
                  stroke="#E2E8F0"
                  strokeDasharray="3 3"
                />
                <text
                  x={d3Geometry.margin.left - 8}
                  y={ty + 3.5}
                  textAnchor="end"
                  className="fill-slate-400 text-[10px] font-mono tabular-nums"
                >
                  {formatTick(tick)}
                </text>
              </g>
            );
          })}

          {/* Area fill */}
          <path d={d3Geometry.areaPath} fill="url(#d3TrendArea)" />

          {/* Linear regression trendline */}
          <line
            x1={d3Geometry.trendStart.x}
            y1={d3Geometry.trendStart.y}
            x2={d3Geometry.trendEnd.x}
            y2={d3Geometry.trendEnd.y}
            stroke="#94A3B8"
            strokeWidth="1.5"
            strokeDasharray="5 4"
          />

          {/* Primary D3 curve */}
          <path
            d={d3Geometry.linePath}
            fill="none"
            stroke={strokeColor}
            strokeWidth="2.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Interactive data points & X labels */}
          {points.map((pt, idx) => {
            const cx = d3Geometry.xScale(pt.label) ?? d3Geometry.margin.left;
            const cy = d3Geometry.yScale(pt.value);
            const isActive = idx === focusedIdx;
            const showLabel =
              points.length <= 8 || idx === 0 || idx === points.length - 1 || idx % 2 === 0;

            return (
              <g
                key={pt.label}
                onMouseEnter={() => setActiveIdx(idx)}
                onClick={() => setActiveIdx(idx)}
                className="cursor-pointer"
              >
                <circle cx={cx} cy={cy} r={16} fill="transparent" />
                <circle
                  cx={cx}
                  cy={cy}
                  r={isActive ? 5.5 : 3.8}
                  fill={isActive ? strokeColor : '#FFFFFF'}
                  stroke={strokeColor}
                  strokeWidth="2.2"
                />
                {showLabel && (
                  <text
                    x={cx}
                    y={d3Geometry.height - 8}
                    textAnchor="middle"
                    className={`text-[10px] ${
                      isActive ? 'fill-[#111827] font-semibold' : 'fill-slate-500'
                    }`}
                  >
                    {pt.label.length > 10 ? pt.label.slice(0, 9) + '…' : pt.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
