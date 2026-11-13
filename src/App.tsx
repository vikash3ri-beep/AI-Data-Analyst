import React, { useEffect, useState, useRef } from 'react';
import {
  Sparkles,
  Database,
  History,
  Smartphone,
  Send,
  Mic,
  MicOff,
  AlertCircle,
  WifiOff,
  Table2,
  ChevronRight,
} from 'lucide-react';
import {
  AnalysisResult,
  ChartType,
  NavTab,
  PipelinePhase,
  TableSchemaInfo,
} from './types';
import { useOnlineStatus } from './hooks/usePWAInstall';
import { PWAInstallButton } from './components/PWAInstallButton';
import { PipelineStepper } from './components/PipelineStepper';
import { SqlViewer } from './components/SqlViewer';
import { SmartChart } from './components/SmartChart';
import { ResultsTable } from './components/ResultsTable';
import { InsightPanel } from './components/InsightPanel';
import { SchemaExplorer } from './components/SchemaExplorer';
import { HistoryView } from './components/HistoryView';
import { MobileAppGuide } from './components/MobileAppGuide';

const STORAGE_KEY = 'asksql_history_v1';

const STARTER_QUESTIONS = [
  'Which product generated the most revenue in Q2 2024?',
  'Show quarterly revenue growth from 2024-Q1 to 2025-Q1',
  'Compare marketing spend vs conversions by channel',
  'Top 5 customers by total revenue and region',
];

const FLAGSHIP_SQL = `SELECT
  product_name,
  SUM(revenue) AS total_revenue,
  SUM(units) AS units_sold
FROM sales
WHERE order_date >= '2024-04-01'
  AND order_date <= '2024-06-30'
GROUP BY product_name
ORDER BY total_revenue DESC
LIMIT 5;`;

interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('analyze');
  const [question, setQuestion] = useState('Which product generated the most revenue in Q2 2024?');
  const [phase, setPhase] = useState<PipelinePhase>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [currentResult, setCurrentResult] = useState<AnalysisResult | null>(null);
  const [activeChart, setActiveChart] = useState<ChartType>('bar');
  const [tables, setTables] = useState<TableSchemaInfo[]>([]);
  const [history, setHistory] = useState<AnalysisResult[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? (JSON.parse(saved) as AnalysisResult[]) : [];
    } catch {
      return [];
    }
  });
  const [isListening, setIsListening] = useState(false);
  const [insightLanguage, setInsightLanguage] = useState<'en' | 'hinglish'>('en');
  const [useFollowUpContext, setUseFollowUpContext] = useState(true);

  const isOnline = useOnlineStatus();
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const timerIdsRef = useRef<number[]>([]);

  const clearPhaseTimers = () => {
    timerIdsRef.current.forEach((id) => window.clearTimeout(id));
    timerIdsRef.current = [];
  };

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 40)));
    } catch {
      // Ignore storage quota errors
    }
  }, [history]);

  const fetchSchema = async () => {
    try {
      const res = await fetch('/api/schema');
      if (res.ok) {
        const data = await res.json();
        setTables(data.tables || []);
      }
    } catch {
      // Schema load fallback handled cleanly
    }
  };

  useEffect(() => {
    fetchSchema();

    // Hydrate the flagship Q2 2024 query against real SQLite engine on initial load
    const hydrateInitial = async () => {
      try {
        const res = await fetch('/api/execute-sql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sql: FLAGSHIP_SQL,
            question: 'Which product generated the most revenue in Q2 2024?',
            skipInsight: true,
          }),
        });
        if (!res.ok) return;
        const data = await res.json();
        const initial: AnalysisResult = {
          id: 'flagship-q2-2024',
          timestamp: Date.now(),
          question: 'Which product generated the most revenue in Q2 2024?',
          intentSummary:
            'Aggregating Q2 2024 sales revenue and unit volume across products ordered from highest to lowest.',
          sql: data.sql,
          recommendedChart: 'bar',
          xAxisKey: 'product_name',
          yAxisKey: 'total_revenue',
          currencyColumns: ['total_revenue'],
          columns: data.columns,
          rows: data.rows,
          rowCount: data.rowCount,
          executionMs: data.executionMs,
          insight: data.insight || {
            headlineInsight:
              'Analytics Pro generated ₹12,45,300 in Q2 2024, leading all products with 33.8% of quarterly revenue.',
            highlightValue: '33.8%',
            highlightLabel: 'Top Revenue Share',
            keyTakeaways: [
              'Analytics Pro and DataPilot together drove 59.4% (₹21.84L) of Q2 revenue.',
              'Top 3 enterprise and growth tools outperformed reporting add-ons by over 4x.',
            ],
            followUpQuestions: [
              'Show quarterly revenue growth from 2024-Q1 to 2025-Q1',
              'Which region generated the most sales for Analytics Pro?',
              'Compare marketing spend vs conversions by channel',
            ],
          },
        };
        setCurrentResult(initial);
        setActiveChart('bar');
      } catch {
        // Ignore initial hydration failure
      }
    };

    hydrateInitial();
    return () => clearPhaseTimers();
  }, []);

  const runAnalysis = async (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed) return;

    setActiveTab('analyze');
    setQuestion(trimmed);
    setErrorMsg(null);
    clearPhaseTimers();

    setPhase('question');
    timerIdsRef.current.push(
      window.setTimeout(() => setPhase('understanding'), 220),
      window.setTimeout(() => setPhase('sql'), 650),
      window.setTimeout(() => setPhase('database'), 1200)
    );

    try {
      const previousContext =
        useFollowUpContext && currentResult
          ? { question: currentResult.question, sql: currentResult.sql }
          : undefined;

      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: trimmed,
          previousContext,
          language: insightLanguage,
        }),
      });

      clearPhaseTimers();
      const data = await res.json();

      if (!res.ok) {
        setPhase('error');
        setErrorMsg(data.error || 'Could not analyze that question. Please try again.');
        return;
      }

      setPhase('analysis');
      window.setTimeout(() => setPhase('insight'), 180);
      window.setTimeout(() => setPhase('idle'), 420);

      const newResult: AnalysisResult = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: Date.now(),
        question: data.question,
        intentSummary: data.intentSummary,
        sql: data.sql,
        recommendedChart: data.recommendedChart || 'bar',
        xAxisKey: data.xAxisKey || '',
        yAxisKey: data.yAxisKey || '',
        currencyColumns: data.currencyColumns || [],
        columns: data.columns || [],
        rows: data.rows || [],
        rowCount: data.rowCount ?? 0,
        executionMs: data.executionMs ?? 1,
        insight: data.insight || null,
      };

      setCurrentResult(newResult);
      setActiveChart(newResult.recommendedChart === 'table' ? 'bar' : newResult.recommendedChart);
      setHistory((prev) => [newResult, ...prev.filter((p) => p.id !== newResult.id)].slice(0, 40));
    } catch {
      clearPhaseTimers();
      setPhase('error');
      setErrorMsg(
        isOnline
          ? 'Server connection failed while running the analysis.'
          : 'You are currently offline. Reconnect to generate new AI SQL queries.'
      );
    }
  };

  const handleRunCustomSql = async (editedSql: string) => {
    setErrorMsg(null);
    setPhase('database');
    try {
      const res = await fetch('/api/execute-sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sql: editedSql,
          question: currentResult?.question || question,
          language: insightLanguage,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPhase('error');
        setErrorMsg(data.error || 'SQL execution failed.');
        return;
      }
      setPhase('idle');
      setCurrentResult((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          sql: data.sql,
          columns: data.columns,
          rows: data.rows,
          rowCount: data.rowCount,
          executionMs: data.executionMs,
          insight: data.insight || prev.insight,
        };
      });
    } catch {
      setPhase('error');
      setErrorMsg('Failed to execute custom SQL.');
    }
  };

  const handleVoiceToggle = () => {
    const SpeechRec =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstance }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionInstance }).webkitSpeechRecognition;

    if (!SpeechRec) {
      setErrorMsg('Voice input is not supported in this browser. Type your question instead.');
      return;
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const rec = new SpeechRec();
    rec.lang = 'en-IN';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript;
      if (transcript) {
        setQuestion(transcript);
        runAnalysis(transcript);
      }
    };
    rec.onerror = () => setIsListening(false);
    rec.onend = () => setIsListening(false);
    recognitionRef.current = rec;
    setIsListening(true);
    rec.start();
  };

  const isRunning = phase !== 'idle' && phase !== 'error';

  const navItems: Array<{ id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'analyze', label: 'Analyze', icon: Sparkles },
    { id: 'tables', label: 'Tables', icon: Database },
    { id: 'history', label: 'History', icon: History },
    { id: 'mobile', label: 'Phone App', icon: Smartphone },
  ];

  return (
    <div className="min-h-screen bg-[#F6F8F7] text-[#111827] flex flex-col lg:flex-row">
      {/* Desktop Left Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white border-r border-emerald-950/10 px-4 py-5 justify-between">
        <div className="space-y-6">
          <div className="px-2">
            <a href="/" className="text-lg font-extrabold tracking-tight text-[#0F5132] whitespace-nowrap">
              AskSQL
            </a>
          </div>

          <nav className="space-y-1" aria-label="Primary navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 min-h-[44px] px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#0F5132] text-white'
                      : 'text-slate-600 hover:bg-[#F3F6F4] hover:text-[#111827]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {tables.length > 0 && (
            <div className="pt-4 border-t border-emerald-950/8">
              <div className="px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Connected Tables
              </div>
              <div className="space-y-1">
                {tables.map((t) => (
                  <button
                    key={t.name}
                    type="button"
                    onClick={() => setActiveTab('tables')}
                    className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs text-slate-600 hover:bg-[#F3F6F4] hover:text-[#111827] transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <Table2 className="w-3.5 h-3.5 text-[#0F5132] shrink-0" />
                      <span className="truncate font-medium">{t.name}</span>
                    </span>
                    <span className="text-[11px] text-slate-400 tabular-nums shrink-0">
                      {t.rowCount}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-emerald-950/8 space-y-3">
          <PWAInstallButton onOpenMobileGuide={() => setActiveTab('mobile')} />
        </div>
      </aside>

      {/* Mobile Compact Sticky Top Bar (52px) */}
      <header className="lg:hidden sticky top-0 z-30 h-[52px] px-4 bg-white/95 backdrop-blur-md border-b border-emerald-950/10 flex items-center justify-between gap-4">
        <a href="/" className="text-base font-extrabold tracking-tight text-[#0F5132] whitespace-nowrap shrink-0">
          AskSQL
        </a>

        <div className="flex items-center gap-2 shrink-0">
          {!isOnline && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
              <WifiOff className="w-3.5 h-3.5" />
              <span>Offline</span>
            </span>
          )}
          <PWAInstallButton compact onOpenMobileGuide={() => setActiveTab('mobile')} />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 lg:pl-64 pb-20 lg:pb-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7 space-y-6">
          {activeTab === 'analyze' && (
            <>
              {/* Hero / Question Composer */}
              <section className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#111827] text-balance">
                      AI Data Analyst
                    </h1>
                    <p className="text-sm text-slate-500 mt-0.5">
                      Ask your database questions in plain English or Hinglish.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
                    <div className="inline-flex items-center gap-1 p-1 bg-white border border-emerald-950/10 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setInsightLanguage('en')}
                        className={`min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                          insightLanguage === 'en'
                            ? 'bg-[#0F5132] text-white'
                            : 'text-slate-600 hover:text-[#111827]'
                        }`}
                      >
                        English
                      </button>
                      <button
                        type="button"
                        onClick={() => setInsightLanguage('hinglish')}
                        className={`min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                          insightLanguage === 'hinglish'
                            ? 'bg-[#0F5132] text-white'
                            : 'text-slate-600 hover:text-[#111827]'
                        }`}
                      >
                        Hinglish
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveTab('tables')}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#0F5132] hover:underline cursor-pointer"
                    >
                      <span>{tables.length || 4} SQLite tables active</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    runAnalysis(question);
                  }}
                  className="rounded-2xl border border-emerald-950/12 bg-white p-2 sm:p-2.5 flex items-center gap-2 focus-within:border-[#0F5132] transition-colors"
                >
                  <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Ask anything, e.g. Which product had highest revenue in Q2?"
                    aria-label="Ask a database question"
                    className="flex-1 min-w-0 min-h-[44px] px-3 text-sm sm:text-[15px] text-[#111827] placeholder:text-slate-400 bg-transparent focus:outline-none"
                  />

                  <button
                    type="button"
                    onClick={handleVoiceToggle}
                    aria-label={isListening ? 'Stop voice input' : 'Speak question'}
                    className={`min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center transition-colors shrink-0 cursor-pointer ${
                      isListening
                        ? 'bg-red-50 text-red-600'
                        : 'text-slate-500 hover:bg-[#F3F6F4] hover:text-[#0F5132]'
                    }`}
                  >
                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>

                  <button
                    type="submit"
                    disabled={isRunning || !question.trim()}
                    className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 sm:px-5 rounded-xl bg-[#0F5132] text-white text-sm font-semibold hover:bg-[#146C43] disabled:opacity-50 active:scale-[0.98] transition-all shrink-0 cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    <span className="hidden sm:inline">{isRunning ? 'Analyzing...' : 'Analyze'}</span>
                  </button>
                </form>

                {/* Starter question buttons + Follow-up memory toggle */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 overflow-x-auto clean-scroll pb-1 max-w-full">
                    {STARTER_QUESTIONS.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => runAnalysis(q)}
                        disabled={isRunning}
                        className="min-h-[36px] px-3 py-1.5 rounded-xl bg-white border border-emerald-950/10 text-xs font-medium text-slate-600 hover:text-[#0F5132] hover:border-[#0F5132]/30 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                      >
                        {q}
                      </button>
                    ))}
                  </div>

                  {currentResult && (
                    <button
                      type="button"
                      onClick={() => setUseFollowUpContext(!useFollowUpContext)}
                      className="text-xs font-medium text-slate-500 hover:text-[#0F5132] transition-colors cursor-pointer"
                    >
                      Follow-up memory: <span className="font-semibold text-[#0F5132]">{useFollowUpContext ? 'On' : 'Off'}</span>
                    </button>
                  )}
                </div>
              </section>

              {/* 6-Stage AI Pipeline */}
              <section className="rounded-2xl border border-emerald-950/10 bg-white px-4 py-3">
                <PipelineStepper phase={phase} hasResult={!!currentResult} />
              </section>

              {errorMsg && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 flex items-start gap-3 text-sm text-red-800">
                  <AlertCircle className="w-5 h-5 shrink-0 text-red-600 mt-0.5" />
                  <div>
                    <div className="font-semibold">Unable to complete query</div>
                    <p className="mt-0.5 text-red-700">{errorMsg}</p>
                  </div>
                </div>
              )}

              {/* Loading Skeleton */}
              {isRunning && (
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 animate-pulse">
                  <div className="xl:col-span-5 h-56 rounded-2xl bg-white border border-emerald-950/8" />
                  <div className="xl:col-span-7 h-56 rounded-2xl bg-white border border-emerald-950/8" />
                </div>
              )}

              {/* Active Result Workspace */}
              {!isRunning && currentResult && (
                <div className="space-y-5">
                  {currentResult.intentSummary && (
                    <div className="text-sm text-slate-600 px-1">
                      <span className="font-semibold text-[#111827]">Understood: </span>
                      <span>{currentResult.intentSummary}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
                    <div className="xl:col-span-5">
                      <SqlViewer
                        sql={currentResult.sql}
                        isRunning={isRunning}
                        onRunCustomSql={handleRunCustomSql}
                      />
                    </div>

                    <div className="xl:col-span-7">
                      <SmartChart
                        recommendedChart={currentResult.recommendedChart}
                        xAxisKey={currentResult.xAxisKey}
                        yAxisKey={currentResult.yAxisKey}
                        currencyColumns={currentResult.currencyColumns}
                        columns={currentResult.columns}
                        rows={currentResult.rows}
                        activeChart={activeChart}
                        onChangeChart={setActiveChart}
                      />
                    </div>
                  </div>

                  <ResultsTable
                    columns={currentResult.columns}
                    rows={currentResult.rows}
                    rowCount={currentResult.rowCount}
                    executionMs={currentResult.executionMs}
                    currencyColumns={currentResult.currencyColumns}
                  />

                  <InsightPanel
                    question={currentResult.question}
                    sql={currentResult.sql}
                    insight={currentResult.insight}
                    result={currentResult}
                    activeChart={activeChart}
                    onSelectFollowUp={(q) => runAnalysis(q)}
                  />
                </div>
              )}
            </>
          )}

          {activeTab === 'tables' && (
            <SchemaExplorer
              tables={tables}
              onRefreshSchema={fetchSchema}
              onAskAboutTable={(q) => runAnalysis(q)}
            />
          )}

          {activeTab === 'history' && (
            <HistoryView
              items={history}
              onOpenItem={(item) => {
                setCurrentResult(item);
                setQuestion(item.question);
                setActiveChart(item.recommendedChart === 'table' ? 'bar' : item.recommendedChart);
                setActiveTab('analyze');
              }}
              onTogglePin={(id) =>
                setHistory((prev) =>
                  prev.map((item) => (item.id === id ? { ...item, pinned: !item.pinned } : item))
                )
              }
              onDeleteItem={(id) => setHistory((prev) => prev.filter((item) => item.id !== id))}
            />
          )}

          {activeTab === 'mobile' && <MobileAppGuide />}
        </div>
      </main>

      {/* Mobile Bottom Thumb-Zone Navigation (56px) */}
      <nav
        aria-label="Mobile navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-emerald-950/10 pb-safe"
      >
        <div className="grid grid-cols-4 h-[56px]">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center justify-center min-h-[44px] gap-0.5 transition-colors cursor-pointer ${
                  active ? 'text-[#0F5132]' : 'text-slate-500'
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? 'stroke-[2.25]' : 'stroke-[1.75]'}`} />
                <span className="text-[10px] font-semibold tracking-tight">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
