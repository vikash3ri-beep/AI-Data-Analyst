import { jsPDF } from 'jspdf';
import { AnalysisResult, ChartType } from '../types';
import { formatCompactINR, formatCellNumber, isLikelyCurrencyColumn } from './formatters';

function pdfSafeText(text: string): string {
  return text.replace(/₹/g, 'Rs. ');
}

function renderChartToDataUrl(result: AnalysisResult, chartType: ChartType): string | null {
  const { columns, rows, xAxisKey, yAxisKey, currencyColumns } = result;
  if (!rows.length || !columns.length) return null;

  const labelKey =
    xAxisKey && columns.includes(xAxisKey)
      ? xAxisKey
      : columns.find((c) => typeof rows[0]?.[c] === 'string') || columns[0];
  const numKey =
    yAxisKey && columns.includes(yAxisKey)
      ? yAxisKey
      : columns.find((c) => c !== labelKey && !Number.isNaN(Number(rows[0]?.[c]))) ||
        columns[columns.length - 1];

  if (!numKey) return null;

  const isCurr = isLikelyCurrencyColumn(numKey, currencyColumns);
  const data = rows.slice(0, 10).map((r, idx) => ({
    label: String(r[labelKey] ?? `Row ${idx + 1}`),
    value: Number(r[numKey]) || 0,
  }));

  const maxVal = Math.max(1, ...data.map((d) => Math.abs(d.value)));
  const totalVal = data.reduce((acc, d) => acc + Math.max(0, d.value), 0);
  const formatVal = (v: number) => (isCurr ? formatCompactINR(v) : formatCellNumber(v, false));

  const canvas = document.createElement('canvas');
  const width = 960;
  const height = 460;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = '#E5EBE7';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, width - 2, height - 2);

  ctx.fillStyle = '#0F5132';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(numKey.replace(/_/g, ' ').toUpperCase(), 36, 44);

  ctx.fillStyle = '#64748B';
  ctx.font = '14px sans-serif';
  ctx.fillText(`${data.length} items visualized`, 36, 68);

  if (chartType === 'donut') {
    const palette = ['#0F5132', '#198754', '#20A86B', '#4CC38A', '#7BD9AC', '#A7E8C9', '#0B3B24'];
    const cx = 230;
    const cy = 250;
    const r = 120;
    let startAngle = -Math.PI / 2;

    data.slice(0, 7).forEach((item, i) => {
      const share = totalVal > 0 ? Math.max(0, item.value) / totalVal : 0;
      const sweep = share * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, startAngle, startAngle + sweep);
      ctx.strokeStyle = palette[i % palette.length];
      ctx.lineWidth = 44;
      ctx.stroke();
      startAngle += sweep;
    });

    ctx.fillStyle = '#111827';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(formatVal(totalVal), cx, cy + 6);

    ctx.textAlign = 'left';
    data.slice(0, 7).forEach((item, i) => {
      const ly = 135 + i * 40;
      ctx.fillStyle = palette[i % palette.length];
      ctx.fillRect(430, ly - 12, 16, 16);
      ctx.fillStyle = '#111827';
      ctx.font = '15px sans-serif';
      const lbl = item.label.length > 22 ? item.label.slice(0, 21) + '…' : item.label;
      ctx.fillText(lbl, 458, ly + 1);
      ctx.fillStyle = '#0F5132';
      ctx.font = 'bold 15px monospace';
      const pct = totalVal > 0 ? ((Math.max(0, item.value) / totalVal) * 100).toFixed(1) : '0.0';
      ctx.fillText(`${formatVal(item.value)} (${pct}%)`, 700, ly + 1);
    });
  } else if (chartType === 'line') {
    const padX = 56;
    const baseY = 385;
    const topY = 105;
    const chartW = width - padX * 2;
    const chartH = baseY - topY;

    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    for (let k = 0; k <= 3; k++) {
      const gy = baseY - (k / 3) * chartH;
      ctx.beginPath();
      ctx.moveTo(padX, gy);
      ctx.lineTo(width - padX, gy);
      ctx.stroke();
    }

    const pts = data.map((d, i) => ({
      x: data.length === 1 ? width / 2 : padX + (i / (data.length - 1)) * chartW,
      y: baseY - (Math.max(0, d.value) / maxVal) * chartH,
      d,
    }));

    ctx.strokeStyle = '#0F5132';
    ctx.lineWidth = 4;
    ctx.beginPath();
    pts.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();

    pts.forEach((p) => {
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0F5132';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = '#0F5132';
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(formatVal(p.d.value), p.x, p.y - 14);

      ctx.fillStyle = '#475569';
      ctx.font = '13px sans-serif';
      const lbl = p.d.label.length > 12 ? p.d.label.slice(0, 11) + '…' : p.d.label;
      ctx.fillText(lbl, p.x, baseY + 26);
    });
  } else {
    const padX = 56;
    const baseY = 385;
    const chartW = width - padX * 2;
    const chartH = 260;
    const slotW = chartW / data.length;
    const barW = Math.min(72, slotW * 0.58);

    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(padX, baseY);
    ctx.lineTo(width - padX, baseY);
    ctx.stroke();

    data.forEach((item, i) => {
      const h = Math.max(8, (Math.abs(item.value) / maxVal) * chartH);
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
      const lbl = item.label.length > 13 ? item.label.slice(0, 12) + '…' : item.label;
      ctx.fillText(lbl, x + barW / 2, baseY + 26);
    });
  }

  return canvas.toDataURL('image/png');
}

export function exportAnalysisToPdf(result: AnalysisResult, activeChart: ChartType) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;

  // Header Banner
  doc.setFillColor(15, 81, 50);
  doc.rect(0, 0, pageWidth, 26, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('AskSQL — Executive Analytics Report', margin, 12.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(`Generated ${new Date(result.timestamp).toLocaleString()}`, margin, 19.5);

  let y = 36;

  // Question
  doc.setTextColor(15, 81, 50);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('QUESTION', margin, y);
  y += 5;

  doc.setTextColor(17, 24, 39);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  const questionLines = doc.splitTextToSize(pdfSafeText(result.question), contentWidth);
  doc.text(questionLines, margin, y);
  y += questionLines.length * 6 + 4;

  // Executive Insight Box
  if (result.insight) {
    const headlineLines = doc.splitTextToSize(
      pdfSafeText(result.insight.headlineInsight),
      result.insight.highlightValue ? contentWidth - 46 : contentWidth - 8
    );
    const takeaways = (result.insight.keyTakeaways || []).flatMap((t) =>
      doc.splitTextToSize(`• ${pdfSafeText(t)}`, contentWidth - 10)
    );
    const boxHeight = Math.max(26, 12 + headlineLines.length * 5.2 + takeaways.length * 4.8 + 4);

    doc.setFillColor(242, 248, 245);
    doc.setDrawColor(190, 220, 204);
    doc.roundedRect(margin, y, contentWidth, boxHeight, 3, 3, 'FD');

    doc.setTextColor(15, 81, 50);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('ACTIONABLE INSIGHT', margin + 4, y + 6.5);

    doc.setTextColor(17, 24, 39);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.text(headlineLines, margin + 4, y + 12.5);

    if (result.insight.highlightValue) {
      const badgeX = pageWidth - margin - 40;
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(badgeX, y + 4, 36, 18, 2, 2, 'FD');
      doc.setTextColor(15, 81, 50);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(pdfSafeText(result.insight.highlightValue), badgeX + 18, y + 12, { align: 'center' });
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(
        pdfSafeText(result.insight.highlightLabel || '').slice(0, 18),
        badgeX + 18,
        y + 18,
        { align: 'center' }
      );
    }

    if (takeaways.length > 0) {
      doc.setTextColor(51, 65, 85);
      doc.setFontSize(9.5);
      doc.text(takeaways, margin + 4, y + 13.5 + headlineLines.length * 5.2);
    }

    y += boxHeight + 7;
  }

  // Embedded Chart Image
  const chartDataUrl = renderChartToDataUrl(result, activeChart === 'table' ? 'bar' : activeChart);
  if (chartDataUrl) {
    const chartH = 78;
    if (y + chartH > pageHeight - 20) {
      doc.addPage();
      y = 18;
    }
    doc.addImage(chartDataUrl, 'PNG', margin, y, contentWidth, chartH);
    y += chartH + 8;
  }

  // SQL Block
  const sqlLines = doc.splitTextToSize(result.sql, contentWidth - 8);
  const sqlBoxH = 10 + sqlLines.length * 4.2;
  if (y + sqlBoxH > pageHeight - 20) {
    doc.addPage();
    y = 18;
  }
  doc.setFillColor(13, 21, 18);
  doc.roundedRect(margin, y, contentWidth, sqlBoxH, 2.5, 2.5, 'F');
  doc.setTextColor(110, 231, 183);
  doc.setFont('courier', 'bold');
  doc.setFontSize(8);
  doc.text('GENERATED SQL', margin + 4, y + 5.5);
  doc.setTextColor(241, 245, 249);
  doc.setFont('courier', 'normal');
  doc.setFontSize(8.5);
  doc.text(sqlLines, margin + 4, y + 10.5);
  y += sqlBoxH + 8;

  // Data Table Summary (Top 10 rows)
  if (result.rows.length > 0 && result.columns.length > 0) {
    if (y + 24 > pageHeight - 15) {
      doc.addPage();
      y = 18;
    }

    doc.setTextColor(15, 81, 50);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(
      `QUERY RESULT (${result.rowCount} rows · ${(result.executionMs / 1000).toFixed(2)}s)`,
      margin,
      y
    );
    y += 5;

    const visibleCols = result.columns.slice(0, 6);
    const colW = contentWidth / visibleCols.length;

    doc.setFillColor(243, 246, 244);
    doc.rect(margin, y, contentWidth, 7, 'F');
    doc.setTextColor(71, 85, 105);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    visibleCols.forEach((col, cIdx) => {
      doc.text(col.replace(/_/g, ' ').slice(0, 18), margin + cIdx * colW + 2, y + 4.8);
    });
    y += 7;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    result.rows.slice(0, 10).forEach((row) => {
      if (y + 6.5 > pageHeight - 12) {
        doc.addPage();
        y = 18;
      }
      doc.setDrawColor(232, 238, 234);
      doc.line(margin, y + 6.5, pageWidth - margin, y + 6.5);
      doc.setTextColor(17, 24, 39);
      visibleCols.forEach((col, cIdx) => {
        const val = row[col];
        const isNum = val !== null && val !== '' && !Number.isNaN(Number(val));
        const isCurr = isLikelyCurrencyColumn(col, result.currencyColumns);
        const formatted = isNum ? formatCellNumber(val, isCurr) : String(val ?? '—');
        doc.text(pdfSafeText(formatted).slice(0, 22), margin + cIdx * colW + 2, y + 4.6);
      });
      y += 6.5;
    });
  }

  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`asksql-report-${stamp}.pdf`);
}
