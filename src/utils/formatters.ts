export function formatCurrencyINR(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

export function formatCompactINR(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 10000000) {
    return `₹${(value / 10000000).toFixed(2)}Cr`;
  }
  if (abs >= 100000) {
    return `₹${(value / 100000).toFixed(2)}L`;
  }
  if (abs >= 1000) {
    return `₹${(value / 1000).toFixed(1)}K`;
  }
  return `₹${Math.round(value)}`;
}

export function formatCellNumber(val: unknown, isCurrency: boolean): string {
  if (val === null || val === undefined) return '—';
  const num = Number(val);
  if (Number.isNaN(num)) return String(val);
  if (isCurrency) {
    return formatCurrencyINR(num);
  }
  if (Number.isInteger(num)) {
    return new Intl.NumberFormat('en-IN').format(num);
  }
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(num);
}

export function isLikelyCurrencyColumn(colName: string, currencyColumns: string[]): boolean {
  if (currencyColumns.includes(colName)) return true;
  return /(revenue|amount|price|spend|cost|sales|profit|budget|income|salary|total_val)/i.test(colName);
}

export function downloadRowsAsCsv(filename: string, columns: string[], rows: Record<string, unknown>[]) {
  const escapeCell = (v: unknown) => {
    const str = v === null || v === undefined ? '' : String(v);
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [
    columns.map(escapeCell).join(','),
    ...rows.map((r) => columns.map((c) => escapeCell(r[c])).join(',')),
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
