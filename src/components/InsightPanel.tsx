import React, { useState, useEffect } from 'react';
import { Lightbulb, ArrowUpRight, Volume2, Square, Share2, Check, FileText } from 'lucide-react';
import { AnalysisResult, ChartType, DataInsight } from '../types';
import { exportAnalysisToPdf } from '../utils/pdfReport';
import { TrendInsightChart } from './TrendInsightChart';

interface InsightPanelProps {
  question: string;
  sql: string;
  insight: DataInsight | null;
  result?: AnalysisResult;
  activeChart?: ChartType;
  onSelectFollowUp: (question: string) => void;
}

export const InsightPanel: React.FC<InsightPanelProps> = ({
  question,
  sql,
  insight,
  result,
  activeChart = 'bar',
  onSelectFollowUp,
}) => {
  const [speaking, setSpeaking] = useState(false);
  const [shared, setShared] = useState(false);
  const [pdfExported, setPdfExported] = useState(false);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [insight]);

  if (!insight) return null;

  const handleToggleSpeech = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const text = [insight.headlineInsight, ...(insight.keyTakeaways || [])].join('. ');
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-IN';
    utterance.rate = 1.0;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  const handleShareSummary = async () => {
    const report = [
      `AskSQL Insight: ${question}`,
      '',
      insight.headlineInsight,
      ...(insight.keyTakeaways || []).map((t) => `- ${t}`),
      insight.highlightValue ? `\nKey Metric: ${insight.highlightValue} (${insight.highlightLabel})` : '',
      `\nSQL:\n${sql}`,
    ]
      .filter(Boolean)
      .join('\n');

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: `AskSQL: ${question}`,
          text: report,
        });
        return;
      } catch {
        // Fallback to clipboard if user cancels share sheet
      }
    }

    try {
      await navigator.clipboard.writeText(report);
      setShared(true);
      window.setTimeout(() => setShared(false), 2000);
    } catch {
      // Ignore clipboard failures
    }
  };

  const supportsSpeech = typeof window !== 'undefined' && 'speechSynthesis' in window;

  return (
    <div className="rounded-2xl border border-[#0F5132]/15 bg-[#F2F8F5] p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-2 flex-1 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0F5132]">
              <Lightbulb className="w-4 h-4 shrink-0" />
              <span>Actionable Insight</span>
            </div>

            <div className="flex items-center gap-1.5">
              {supportsSpeech && (
                <button
                  type="button"
                  onClick={handleToggleSpeech}
                  className="inline-flex items-center gap-1.5 min-h-[36px] px-2.5 py-1 rounded-lg bg-white border border-emerald-950/10 text-xs font-medium text-[#111827] hover:border-[#0F5132]/35 cursor-pointer"
                >
                  {speaking ? (
                    <>
                      <Square className="w-3 h-3 text-red-600 fill-red-600" />
                      <span>Stop</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-3.5 h-3.5 text-[#0F5132]" />
                      <span>Listen</span>
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  if (!result) return;
                  exportAnalysisToPdf(result, activeChart);
                  setPdfExported(true);
                  window.setTimeout(() => setPdfExported(false), 2000);
                }}
                disabled={!result}
                className="inline-flex items-center gap-1.5 min-h-[36px] px-2.5 py-1 rounded-lg bg-[#0F5132] text-white text-xs font-semibold hover:bg-[#146C43] disabled:opacity-50 transition-colors cursor-pointer"
              >
                {pdfExported ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>PDF Saved</span>
                  </>
                ) : (
                  <>
                    <FileText className="w-3.5 h-3.5" />
                    <span>Export to PDF</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleShareSummary}
                className="inline-flex items-center gap-1.5 min-h-[36px] px-2.5 py-1 rounded-lg bg-white border border-emerald-950/10 text-xs font-medium text-[#111827] hover:border-[#0F5132]/35 cursor-pointer"
              >
                {shared ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#0F5132]" />
                    <span className="text-[#0F5132]">Copied</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-3.5 h-3.5 text-[#0F5132]" />
                    <span>Share</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <p className="text-[15px] font-medium text-[#111827] leading-relaxed">
            {insight.headlineInsight}
          </p>

          {insight.keyTakeaways && insight.keyTakeaways.length > 0 && (
            <ul className="pt-1 space-y-1.5 text-sm text-slate-700">
              {insight.keyTakeaways.map((point, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-[#0F5132] font-bold mt-0.5">·</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {insight.highlightValue && (
          <div className="sm:w-40 shrink-0 rounded-xl bg-white border border-[#0F5132]/15 p-3.5 flex sm:flex-col items-center sm:items-start justify-between gap-1">
            <div className="text-2xl font-bold text-[#0F5132] tabular-nums">
              {insight.highlightValue}
            </div>
            <div className="text-xs font-medium text-slate-500 text-right sm:text-left">
              {insight.highlightLabel}
            </div>
          </div>
        )}
      </div>

      {result && <TrendInsightChart result={result} />}

      {insight.followUpQuestions && insight.followUpQuestions.length > 0 && (
        <div className="mt-4 pt-3.5 border-t border-[#0F5132]/10">
          <div className="text-xs font-medium text-slate-500 mb-2">Explore next</div>
          <div className="flex flex-wrap gap-2">
            {insight.followUpQuestions.map((q, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectFollowUp(q)}
                className="inline-flex items-center gap-1.5 min-h-[38px] px-3 py-1.5 rounded-xl bg-white border border-emerald-950/10 text-xs font-medium text-[#111827] hover:border-[#0F5132]/40 hover:text-[#0F5132] active:scale-[0.98] transition-all text-left cursor-pointer"
              >
                <span>{q}</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-[#0F5132] shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
