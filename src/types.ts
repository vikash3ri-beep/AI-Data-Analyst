export type ChartType = 'bar' | 'line' | 'donut' | 'table' | 'kpi';

export type NavTab = 'analyze' | 'tables' | 'history' | 'mobile';

export interface ColumnInfo {
  name: string;
  type: string;
}

export interface TableSchemaInfo {
  name: string;
  rowCount: number;
  columns: ColumnInfo[];
  sampleRows: Record<string, unknown>[];
  isCustom: boolean;
}

export interface DataInsight {
  headlineInsight: string;
  highlightValue: string;
  highlightLabel: string;
  keyTakeaways: string[];
  followUpQuestions: string[];
}

export interface AnalysisResult {
  id: string;
  timestamp: number;
  question: string;
  intentSummary: string;
  sql: string;
  recommendedChart: ChartType;
  xAxisKey: string;
  yAxisKey: string;
  currencyColumns: string[];
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  executionMs: number;
  insight: DataInsight | null;
  pinned?: boolean;
}

export type PipelinePhase =
  | 'idle'
  | 'question'
  | 'understanding'
  | 'sql'
  | 'database'
  | 'analysis'
  | 'insight'
  | 'error';
