import { CheckCircle2, Clock, Play, X } from 'lucide-react';
import { useState } from 'react';

interface WalkthroughModalProps {
  companyName: string;
  onClose: () => void;
  onBookCall: () => void;
}

const CHAPTERS = [
  {
    id: 'footprint',
    time: '00:00',
    title: 'Local Footprint & Map Pack Audit',
    summary:
      'Analysis of your current Google Business Profile citations, service-radius gaps, and top 3 competitor keyword rankings.',
    metric: '+45% Local Visibility Target',
  },
  {
    id: 'reviews',
    time: '00:44',
    title: 'Automated Review Velocity Engine',
    summary:
      'Post-job SMS and email sequence that routes satisfied homeowners to Google while intercepting private service issues early.',
    metric: '4.9 Rating Benchmark',
  },
  {
    id: 'funnels',
    time: '01:22',
    title: 'Instant Quote & Missed-Call Funnel',
    summary:
      'Replacing static forms with rapid quote estimators and automated 60-second SMS follow-ups that capture after-hours calls.',
    metric: '2.4x Lead Conversion Lift',
  },
];

export function WalkthroughModal({
  companyName,
  onClose,
  onBookCall,
}: WalkthroughModalProps) {
  const [activeChapterId, setActiveChapterId] = useState(CHAPTERS[0].id);
  const activeChapter =
    CHAPTERS.find((c) => c.id === activeChapterId) || CHAPTERS[0];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="walkthrough-modal-title"
    >
      <div className="bg-white rounded-xl max-w-3xl w-full overflow-hidden border border-[#E2E8F0] shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <div>
            <p className="text-xs font-medium text-[#64748B]">
              Personalized Walkthrough · {companyName}
            </p>
            <h3
              id="walkthrough-modal-title"
              className="text-lg font-semibold text-[#191c1e]"
            >
              2-Minute Local Acquisition Strategy Breakdown
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close walkthrough"
            className="p-2 rounded-lg text-[#64748B] hover:text-[#191c1e] hover:bg-[#f2f4f6] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="relative rounded-xl overflow-hidden bg-[#0d1c32] aspect-video border border-[#E2E8F0]">
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBTWAuptpLMiUfivJTXPk9wFd9SJlahwJKIaf3drU48wDdjEKwNzm7CU9NDNKT9kiQQsAg2oYGg0Di3QagVSBxag-n_oMTBiNZe2uEx1oWasXzufKA-GwgJMrRxCAzW59hyaAZEpJvGe-fXvvYSPNhE_Is9if50-6YmM71jfkKZoV6nkRe-lEoofTUaZsnruXU1YqlBBdqbrtIVuPLSjZhdTHW7qkhM8QF9jW6dE7x1"
              alt="Consultant presenting local growth metrics dashboard"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover opacity-55"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/20 p-6 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-white/90">
                <span className="inline-flex items-center gap-1.5 bg-black/60 px-3 py-1.5 rounded-lg font-mono-tabular">
                  <Clock className="w-3.5 h-3.5" />
                  Chapter {activeChapter.time} / 02:00
                </span>
                <span className="bg-[#00677d] px-3 py-1.5 rounded-lg font-semibold">
                  {activeChapter.metric}
                </span>
              </div>

              <div className="max-w-xl">
                <div className="inline-flex items-center gap-2 text-white/80 text-xs font-medium mb-1">
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Now Reviewing
                </div>
                <h4 className="text-xl font-bold text-white mb-1.5">
                  {activeChapter.title}
                </h4>
                <p className="text-sm text-white/85 leading-relaxed">
                  {activeChapter.summary}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {CHAPTERS.map((chapter) => {
              const selected = chapter.id === activeChapterId;
              return (
                <button
                  key={chapter.id}
                  type="button"
                  onClick={() => setActiveChapterId(chapter.id)}
                  className={`text-left p-3.5 rounded-lg border transition-colors ${
                    selected
                      ? 'bg-[#0d1c32] text-white border-[#0d1c32]'
                      : 'bg-[#f7f9fb] text-[#191c1e] border-[#E2E8F0] hover:bg-[#eceef0]'
                  }`}
                >
                  <div
                    className={`text-xs font-mono-tabular mb-1 ${
                      selected ? 'text-[#50d9fe]' : 'text-[#64748B]'
                    }`}
                  >
                    {chapter.time}
                  </div>
                  <div className="text-sm font-semibold leading-snug">
                    {chapter.title}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-[#E2E8F0]">
            <div className="flex items-center gap-2 text-sm text-[#44474d]">
              <CheckCircle2 className="w-4 h-4 text-[#00677d] shrink-0" />
              <span>Custom competitor breakdown included on your strategy call.</span>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                onBookCall();
              }}
              className="bg-black text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-[#515f78] transition-colors whitespace-nowrap shrink-0"
            >
              Book 15-Minute Strategy Call
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
