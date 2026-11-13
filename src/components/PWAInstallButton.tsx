import React, { useState } from 'react';
import { Download, Smartphone, CheckCircle2, X, Share } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
  onOpenMobileGuide?: () => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  compact = false,
  onOpenMobileGuide,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    if (compact) return null;
    return (
      <div className="flex items-center gap-2 text-xs font-medium text-[#0F5132]">
        <CheckCircle2 className="w-4 h-4 shrink-0" />
        <span>Installed on Device</span>
      </div>
    );
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex items-center justify-center gap-2 min-h-[40px] px-3.5 py-2 rounded-xl bg-[#0F5132] text-white text-xs font-semibold hover:bg-[#146C43] active:scale-[0.98] transition-all whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>Install App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex items-center justify-center gap-1.5 min-h-[40px] px-3 py-2 rounded-xl border border-emerald-950/15 bg-white text-[#111827] text-xs font-semibold hover:bg-emerald-50/50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Share className="w-3.5 h-3.5 text-[#0F5132] shrink-0" />
          <span>Add to Phone</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 border border-emerald-950/10 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-[#111827]">Install on iPhone</h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Close install guide"
                  className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ol className="mt-3 space-y-2.5 text-sm text-slate-600">
                <li>1. Tap the <strong>Share</strong> icon in Safari&apos;s toolbar.</li>
                <li>2. Scroll down and tap <strong>Add to Home Screen</strong>.</li>
                <li>3. Open <strong>AskSQL</strong> directly from your home screen.</li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full min-h-[44px] rounded-xl bg-[#0F5132] text-white text-sm font-semibold hover:bg-[#146C43] cursor-pointer"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  if (onOpenMobileGuide) {
    return (
      <button
        type="button"
        onClick={onOpenMobileGuide}
        className="inline-flex items-center justify-center gap-1.5 min-h-[40px] px-3 py-2 rounded-xl border border-emerald-950/15 bg-white text-[#111827] text-xs font-semibold hover:bg-emerald-50/50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Smartphone className="w-3.5 h-3.5 text-[#0F5132] shrink-0" />
        <span>Phone App</span>
      </button>
    );
  }

  return null;
};
