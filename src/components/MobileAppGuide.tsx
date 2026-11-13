import React from 'react';
import {
  Sparkles,
  Database,
  FileSpreadsheet,
  FileText,
  TrendingUp,
  Download,
  CheckCircle2,
  Globe,
  ArrowRight,
  Mic,
} from 'lucide-react';
import { usePWAInstall, useOnlineStatus } from '../hooks/usePWAInstall';

interface WebAppGuideProps {
  onTryQuestion: (question: string) => void;
}

const CAPABILITIES = [
  {
    icon: Sparkles,
    title: 'Plain English & Hinglish to SQL',
    desc: 'Ask business questions naturally and inspect the exact SQLite query generated for every answer.',
  },
  {
    icon: Database,
    title: 'Live SQLite Engine + Custom CSVs',
    desc: 'Upload any CSV dataset in the Tables tab, preview rows in a modal, and query it immediately.',
  },
  {
    icon: TrendingUp,
    title: 'Interactive Charts & D3 Trend Insight',
    desc: 'Switch between Bar, Trend, Donut, and KPI views with automatic D3 growth/decline detection.',
  },
  {
    icon: FileSpreadsheet,
    title: 'CSV & Formatted PDF Exports',
    desc: 'Download query tables as CSV or export an executive summary + chart report as an A4 PDF.',
  },
  {
    icon: Mic,
    title: 'Voice Input & Audio Readout',
    desc: 'Speak your question with the microphone button and listen to key insights hands-free.',
  },
  {
    icon: Globe,
    title: 'Works Directly in Any Browser',
    desc: 'Runs cleanly on desktop and mobile browsers with offline caching and fast responsive layout.',
  },
];

const QUICK_PROMPTS = [
  'Which product generated the most revenue in Q2 2024?',
  'Show quarterly revenue growth from 2024-Q1 to 2025-Q1',
  'Compare marketing spend vs conversions by channel',
  'Top 5 customers by total revenue and region',
];

export const MobileAppGuide: React.FC<WebAppGuideProps> = ({ onTryQuestion }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const isOnline = useOnlineStatus();

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#111827]">AskSQL Web App Guide</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Full-featured AI Data Analyst running directly in your web browser — zero extra downloads required.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isInstalled ? (
            <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-50 text-[#0F5132] text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Installed in Browser</span>
            </div>
          ) : isInstallable ? (
            <button
              type="button"
              onClick={install}
              className="inline-flex items-center gap-2 min-h-[40px] px-4 py-2 rounded-xl bg-[#0F5132] text-white text-xs font-semibold hover:bg-[#146C43] active:scale-[0.98] transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Add Web Shortcut</span>
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CAPABILITIES.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              className="rounded-2xl border border-emerald-950/10 bg-white p-4 sm:p-5 flex items-start gap-3.5"
            >
              <div className="w-10 h-10 rounded-xl bg-[#F3F6F4] text-[#0F5132] flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#111827]">{item.title}</h3>
                <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-emerald-950/10 bg-white p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#0F5132]" />
            <h3 className="text-sm font-bold text-[#111827]">Try a Sample Query Now</h3>
          </div>
          <span className="text-xs text-slate-400">
            {isOnline ? 'Live AI + SQLite Online' : 'Offline Cached Mode'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onTryQuestion(prompt)}
              className="flex items-center justify-between gap-2 min-h-[44px] px-3.5 py-2.5 rounded-xl border border-emerald-950/12 bg-[#F8FAF9] text-left text-xs sm:text-sm font-medium text-[#111827] hover:border-[#0F5132]/40 hover:bg-emerald-50/40 transition-colors cursor-pointer group"
            >
              <span>{prompt}</span>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#0F5132] shrink-0 transition-colors" />
            </button>
          ))}
        </div>

        {isIOS && !isInstalled && (
          <p className="text-xs text-slate-500 pt-1">
            Tip for Safari: Tap <strong>Share → Add to Home Screen</strong> anytime to pin this web app for quick access.
          </p>
        )}
      </div>
    </div>
  );
};
