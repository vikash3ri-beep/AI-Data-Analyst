import React from 'react';
import {
  MessageSquare,
  BrainCircuit,
  Code2,
  Database,
  BarChart3,
  Lightbulb,
  Check,
  Loader2,
} from 'lucide-react';
import { PipelinePhase } from '../types';

interface PipelineStepperProps {
  phase: PipelinePhase;
  hasResult: boolean;
}

const STEPS = [
  { key: 'question', label: 'Question', sub: 'Natural language', icon: MessageSquare },
  { key: 'understanding', label: 'AI Intent', sub: 'Parses goal', icon: BrainCircuit },
  { key: 'sql', label: 'SQL Gen', sub: 'Optimized query', icon: Code2 },
  { key: 'database', label: 'Database', sub: 'Runs SQLite', icon: Database },
  { key: 'analysis', label: 'Analysis', sub: 'Charts & rows', icon: BarChart3 },
  { key: 'insight', label: 'Insight', sub: 'Key takeaway', icon: Lightbulb },
] as const;

const PHASE_ORDER: Record<PipelinePhase, number> = {
  idle: -1,
  question: 0,
  understanding: 1,
  sql: 2,
  database: 3,
  analysis: 4,
  insight: 5,
  error: 2,
};

export const PipelineStepper: React.FC<PipelineStepperProps> = ({ phase, hasResult }) => {
  const activeIndex = phase === 'idle' && hasResult ? 6 : PHASE_ORDER[phase];
  const isRunning = phase !== 'idle' && phase !== 'error';

  return (
    <div className="w-full overflow-x-auto clean-scroll py-1">
      <div className="flex items-center justify-between min-w-[540px] gap-1.5">
        {STEPS.map((step, idx) => {
          const Icon = step.icon;
          const isComplete = activeIndex > idx || (phase === 'idle' && hasResult);
          const isActive = isRunning && activeIndex === idx;

          return (
            <React.Fragment key={step.key}>
              <div className="flex items-center gap-2 shrink-0">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-colors ${
                    isComplete
                      ? 'bg-[#0F5132] border-[#0F5132] text-white'
                      : isActive
                        ? 'bg-emerald-50 border-[#0F5132] text-[#0F5132]'
                        : 'bg-white border-emerald-950/12 text-slate-400'
                  }`}
                >
                  {isActive ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isComplete ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>
                <div className="leading-tight">
                  <div
                    className={`text-xs font-semibold whitespace-nowrap ${
                      isComplete || isActive ? 'text-[#111827]' : 'text-slate-400'
                    }`}
                  >
                    {step.label}
                  </div>
                  <div className="text-[11px] text-slate-500 whitespace-nowrap">{step.sub}</div>
                </div>
              </div>
              {idx < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-px min-w-[12px] ${
                    activeIndex > idx ? 'bg-[#0F5132]/50' : 'bg-emerald-950/10'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
