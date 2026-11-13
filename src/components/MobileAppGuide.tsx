import React, { useState, useEffect } from 'react';
import { Smartphone, Download, CheckCircle2, Copy, Check, Terminal, Wifi, AlertTriangle } from 'lucide-react';
import { usePWAInstall, useOnlineStatus } from '../hooks/usePWAInstall';

export const MobileAppGuide: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const isOnline = useOnlineStatus();
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [manifestReady, setManifestReady] = useState<boolean | null>(null);

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://your-public-app-url.run.app';
  const isPrivatePreview =
    typeof window !== 'undefined' &&
    (window.location.hostname.startsWith('ais-dev-') || window.location.hostname === 'localhost');

  const apkBaseUrl = isPrivatePreview ? 'https://YOUR-PUBLIC-DEPLOYED-URL.run.app' : currentOrigin;
  const twaCommand = `npx @bubblewrap/cli init --manifest ${apkBaseUrl}/manifest.webmanifest && npx @bubblewrap/cli build`;

  useEffect(() => {
    fetch('/manifest.webmanifest', { credentials: 'same-origin' })
      .then((res) => setManifestReady(res.ok))
      .catch(() => setManifestReady(false));
  }, []);

  const copyCommand = async () => {
    try {
      await navigator.clipboard.writeText(twaCommand);
      setCopiedCmd(true);
      setTimeout(() => setCopiedCmd(false), 1800);
    } catch {
      // Ignore clipboard failures
    }
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h2 className="text-xl font-bold text-[#111827]">Install on Your Phone</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Run AskSQL full-screen on Android or iOS right now, or package a publicly deployed URL into a signed Android APK.
        </p>
      </div>

      <div className="rounded-2xl border border-emerald-950/10 bg-white p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-[#0F5132] text-white flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#111827]">
                Option 1: Instant Phone App (Zero APK Needed)
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                AskSQL is a compliant Progressive Web App (PWA). Installing it puts the AskSQL icon on your Android/iOS home screen and launches full-screen without browser bars.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          {isInstalled ? (
            <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 text-[#0F5132] text-sm font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Already Installed on This Device</span>
            </div>
          ) : isInstallable ? (
            <button
              type="button"
              onClick={install}
              className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-[#0F5132] text-white text-sm font-semibold hover:bg-[#146C43] active:scale-[0.98] transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Install AskSQL Now</span>
            </button>
          ) : isIOS ? (
            <div className="w-full rounded-xl bg-[#F8FAF9] border border-emerald-950/10 p-3.5 text-sm text-slate-700">
              On iPhone Safari: Tap <strong>Share</strong> then tap <strong>Add to Home Screen</strong>.
            </div>
          ) : (
            <div className="w-full rounded-xl bg-[#F8FAF9] border border-emerald-950/10 p-3.5 text-sm text-slate-700">
              Open this URL in <strong>Android Chrome</strong>, tap the <strong>⋮ menu</strong> (top-right), and select <strong>Install app</strong> / <strong>Add to Home screen</strong>.
            </div>
          )}

          <div className="inline-flex items-center gap-1.5 text-xs text-slate-500">
            <Wifi className="w-3.5 h-3.5 text-[#0F5132]" />
            <span>
              {isOnline ? 'Online' : 'Offline'} ·{' '}
              {manifestReady === null
                ? 'Checking PWA manifest...'
                : manifestReady
                ? 'PWA Manifest & Service Worker Ready'
                : 'Manifest check pending'}
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-emerald-950/10 bg-white p-5 space-y-3">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#F3F6F4] text-[#0F5132] flex items-center justify-center shrink-0">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#111827]">
              Option 2: Generate a Signed Android .APK File
            </h3>
            <p className="text-sm text-slate-600 mt-1">
              Because this cloud studio builds web apps rather than running Android Gradle locally, you can turn your deployed public URL into a native Android <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">.apk</code> using Google&apos;s official <strong>Bubblewrap</strong> CLI or <strong>PWABuilder.com</strong>.
            </p>
          </div>
        </div>

        {isPrivatePreview && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 flex items-start gap-2.5 text-xs sm:text-sm text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Why PWABuilder times out on preview URLs: </span>
              <span className="font-mono text-xs">{currentOrigin}</span> is a private AI Studio preview URL behind Google login, so external tools like PWABuilder cannot read its <code className="font-mono">/manifest.webmanifest</code>. First click <strong>Deploy / Share</strong> in AI Studio to publish a <strong>public Cloud Run URL</strong>, then paste that public URL into PWABuilder.
            </div>
          </div>
        )}

        <ol className="space-y-2 text-sm text-slate-700 pl-1">
          <li>
            1. Deploy the app to Cloud Run with public access enabled and copy the <strong>public deployed URL</strong> (not the <code className="font-mono text-xs">ais-dev-</code> preview URL).
          </li>
          <li>
            2. Paste that public URL into <strong>pwabuilder.com</strong> → Package for Store → Android APK, <em>or</em> run Google Bubblewrap locally:
          </li>
        </ol>

        <div className="rounded-xl bg-[#0D1512] p-3.5 flex items-center justify-between gap-3">
          <code className="font-mono text-xs text-emerald-200 overflow-x-auto whitespace-nowrap clean-scroll">
            {twaCommand}
          </code>
          <button
            type="button"
            onClick={copyCommand}
            className="inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-lg bg-white/10 text-white text-xs font-medium hover:bg-white/20 shrink-0 cursor-pointer"
          >
            {copiedCmd ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedCmd ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
