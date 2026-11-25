import {
  ArrowRight,
  BadgeCheck,
  Check,
  CheckCircle2,
  Filter,
  Globe,
  Layers,
  MessageSquareQuote,
  Play,
  PlayCircle,
  Quote,
  Star,
  TrendingUp,
  UserPlus,
  Zap,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  BLUEPRINT_LIMITS,
  clampText,
  isValidEmailFormat,
} from '../lib/validation';
import type { SlotsResponse } from '../types/domain';
import type { ActiveRoute } from './Navbar';
import { WalkthroughModal } from './WalkthroughModal';

interface LandingPageProps {
  onNavigate: (route: ActiveRoute, sectionId?: string) => void;
}

const DEFAULT_SLOTS: SlotsResponse = {
  timezone: 'EST',
  dates: [
    {
      id: 'day_1',
      label: 'Tomorrow',
      dateText: 'Oct 24',
      fullLabel: 'Tomorrow (Oct 24)',
    },
    {
      id: 'day_2',
      label: 'Thursday',
      dateText: 'Oct 25',
      fullLabel: 'Thursday (Oct 25)',
    },
    {
      id: 'day_3',
      label: 'Friday',
      dateText: 'Oct 26',
      fullLabel: 'Friday (Oct 26)',
    },
  ],
  timeSlots: ['10:00 AM', '01:30 PM', '04:00 PM'],
};

export function LandingPage({ onNavigate }: LandingPageProps) {
  const { user, userProfile, signInWithGoogle, getAuthHeaders } = useAuth();

  const companyName = userProfile?.companyName || 'Apex Roofing';
  const inboundGrowth = userProfile?.inboundCallsGrowth ?? 142;
  const projectedRevenue = userProfile?.projectedRevenue ?? 48500;

  const [slots, setSlots] = useState<SlotsResponse>(DEFAULT_SLOTS);
  const [selectedDateId, setSelectedDateId] = useState<string>('day_2');
  const [selectedTime, setSelectedTime] = useState<string>('01:30 PM');
  const [contactName, setContactName] = useState<string>('');
  const [workEmail, setWorkEmail] = useState<string>('');
  const [bookingCompany, setBookingCompany] = useState<string>('');
  const [bookingBusy, setBookingBusy] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [confirmedCode, setConfirmedCode] = useState<string | null>(null);
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [videoImgFailed, setVideoImgFailed] = useState(false);
  const [avatarImgFailed, setAvatarImgFailed] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/slots')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: SlotsResponse | null) => {
        if (active && data?.dates?.length) {
          setSlots(data);
          setSelectedDateId(data.dates[1]?.id || data.dates[0].id);
        }
      })
      .catch(() => {
        // Fallback to default slots cleanly
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (userProfile) {
      if (!contactName) setContactName(userProfile.displayName || '');
      if (!workEmail) setWorkEmail(userProfile.email || '');
      if (!bookingCompany) setBookingCompany(userProfile.companyName || '');
    }
  }, [userProfile]);

  const selectedDateObj =
    slots.dates.find((d) => d.id === selectedDateId) || slots.dates[0];

  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingError(null);
    setConfirmedCode(null);

    const cleanName = clampText(
      contactName,
      BLUEPRINT_LIMITS.maxDisplayNameLength,
    );
    const cleanEmail = clampText(workEmail, BLUEPRINT_LIMITS.maxEmailLength);
    const cleanCompany = clampText(
      bookingCompany || companyName,
      BLUEPRINT_LIMITS.maxCompanyNameLength,
    );

    if (!cleanName) {
      setBookingError('Please enter your full name.');
      return;
    }
    if (!isValidEmailFormat(cleanEmail)) {
      setBookingError('Please enter a valid work email address.');
      return;
    }

    setBookingBusy(true);
    try {
      let activeUser = user;
      if (!activeUser) {
        activeUser = await signInWithGoogle();
        if (!activeUser) {
          setBookingError(
            'Sign in with Google to lock in your strategy call and view it in your Client Portal.',
          );
          setBookingBusy(false);
          return;
        }
      }

      const token = await activeUser.getIdToken();
      const headers = user
        ? await getAuthHeaders()
        : {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          };

      const validateRes = await fetch('/api/bookings/validate', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          contactName: cleanName,
          workEmail: cleanEmail,
          companyName: cleanCompany,
          dateLabel: selectedDateObj.fullLabel,
          timeSlot: selectedTime,
        }),
      });

      const payload = (await validateRes.json()) as {
        error?: string;
        booking?: {
          userId: string;
          userEmail: string;
          contactName: string;
          workEmail: string;
          companyName: string;
          dateLabel: string;
          timeSlot: string;
          status: 'pending';
          confirmationCode: string;
          notes: string;
        };
      };

      if (!validateRes.ok || !payload.booking) {
        setBookingError(payload.error || 'Unable to validate booking slot.');
        setBookingBusy(false);
        return;
      }

      const bookingRef = doc(collection(db, 'bookings'));
      const bookingPath = `bookings/${bookingRef.id}`;
      try {
        await setDoc(bookingRef, {
          ...payload.booking,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (fsErr) {
        handleFirestoreError(fsErr, OperationType.CREATE, bookingPath);
      }

      setConfirmedCode(payload.booking.confirmationCode);
    } catch (err) {
      setBookingError(
        err instanceof Error
          ? err.message
          : 'Could not schedule strategy call. Please try again.',
      );
    } finally {
      setBookingBusy(false);
    }
  };

  return (
    <div className="flex flex-col w-full bg-[#f7f9fb] text-[#191c1e]">
      {/* Hero Section */}
      <section
        id="overview"
        className="relative px-6 lg:px-12 pt-12 pb-20 overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-black/5 via-transparent to-[#00677d]/10 pointer-events-none" />
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
          <div className="lg:col-span-7 flex flex-col items-start gap-6">
            <div className="inline-flex items-center gap-2 bg-[#e6e8ea] px-4 py-2 rounded-lg border border-[#E2E8F0]">
              <BadgeCheck className="w-4 h-4 text-black shrink-0" />
              <span className="text-sm font-semibold text-[#191c1e]">
                Built exclusively for your team at {companyName}
              </span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-[56px] font-bold leading-[1.14] tracking-[-0.02em] text-[#191c1e] text-balance">
              Drive 3x More Local Customers Without Increasing Ad Spend
            </h1>

            <p className="text-lg text-[#64748B] max-w-2xl leading-relaxed">
              Stop bleeding budget on ineffective campaigns. We deploy
              hyper-targeted local acquisition systems that capture high-intent
              buyers right when they search for your services.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                type="button"
                onClick={() => onNavigate(user ? 'portal' : 'login')}
                className="bg-black text-white text-sm font-semibold px-6 py-4 rounded-lg hover:bg-[#515f78] transition-colors shadow-md inline-flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                Claim Your Free Growth Audit
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setShowWalkthrough(true)}
                className="bg-[#e6e8ea] text-[#191c1e] text-sm font-semibold px-6 py-4 rounded-lg hover:bg-[#d8dadc] transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <PlayCircle className="w-4 h-4" />
                Watch 2-Min Demo
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-6 pt-2 text-[#64748B] text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-black shrink-0" />
                <span>No long-term contracts</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-black shrink-0" />
                <span>Setup in 48 hours</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="bg-white p-6 rounded-xl shadow-xl border border-[#E2E8F0] relative">
              <div className="absolute -top-3 right-4 bg-[#00677d] text-white text-xs font-semibold px-3 py-1 rounded-md shadow-sm">
                Live ROI Preview
              </div>

              <h2 className="text-lg font-semibold text-[#191c1e] mb-5">
                {companyName} Estimated Growth
              </h2>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-[#64748B]">Inbound Calls</span>
                    <span className="font-bold text-[#191c1e] tabular-nums">
                      +{inboundGrowth}% MoM
                    </span>
                  </div>
                  <div className="w-full h-2 bg-[#eceef0] rounded-full overflow-hidden">
                    <div
                      className="bg-black h-full rounded-full"
                      style={{ width: '75%' }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-[#64748B]">Google Map Rankings</span>
                    <span className="font-bold text-[#191c1e]">
                      Top 3 Position
                    </span>
                  </div>
                  <div className="w-full h-2 bg-[#eceef0] rounded-full overflow-hidden">
                    <div
                      className="bg-[#00677d] h-full rounded-full"
                      style={{ width: '90%' }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-[#64748B]">
                      Review Acquisition Rate
                    </span>
                    <span className="font-bold text-[#191c1e] tabular-nums">
                      4.9 ★ (128 new)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-[#eceef0] rounded-full overflow-hidden">
                    <div
                      className="bg-black h-full rounded-full"
                      style={{ width: '85%' }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-[#E2E8F0] flex items-center justify-between">
                <span className="text-sm text-[#64748B]">
                  Projected Extra Revenue
                </span>
                <span className="text-2xl font-bold text-black font-mono-tabular">
                  ${projectedRevenue.toLocaleString()}/mo
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Video / Loom Mockup Section */}
      <section id="demo" className="px-6 lg:px-12 py-24 bg-[#f2f4f6]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <p className="text-xs font-semibold text-[#64748B] tracking-wide mb-2">
              Personalized Walkthrough
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#191c1e] tracking-tight mb-4 text-balance">
              See How We Will Scale {companyName}
            </h2>
            <p className="text-base text-[#64748B]">
              A quick 2-minute breakdown analyzing your current local footprint
              and our exact execution strategy.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowWalkthrough(true)}
            className="w-full relative rounded-xl overflow-hidden shadow-2xl bg-[#0d1c32] aspect-video flex items-center justify-center group cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
          >
            {!videoImgFailed ? (
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBTWAuptpLMiUfivJTXPk9wFd9SJlahwJKIaf3drU48wDdjEKwNzm7CU9NDNKT9kiQQsAg2oYGg0Di3QagVSBxag-n_oMTBiNZe2uEx1oWasXzufKA-GwgJMrRxCAzW59hyaAZEpJvGe-fXvvYSPNhE_Is9if50-6YmM71jfkKZoV6nkRe-lEoofTUaZsnruXU1YqlBBdqbrtIVuPLSjZhdTHW7qkhM8QF9jW6dE7x1"
                alt="Consultant presenting local growth strategy and dashboard"
                referrerPolicy="no-referrer"
                onError={() => setVideoImgFailed(true)}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-[#0d1c32] via-[#192c47] to-[#004e5f]" />
            )}

            <div className="absolute inset-0 bg-black/45 group-hover:bg-black/35 transition-colors" />

            <div className="relative z-10 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-20 h-20 rounded-full bg-white text-black flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform mb-4">
                <Play className="w-8 h-8 fill-current ml-0.5" />
              </div>
              <span className="text-white text-lg font-semibold tracking-wide">
                Watch Personalized Breakdown for {companyName}
              </span>
              <span className="text-white/80 text-sm mt-1">
                Duration: 2 minutes · Recorded specifically for your team
              </span>
            </div>
          </button>
        </div>
      </section>

      {/* Proof & Metrics Section */}
      <section id="results" className="px-6 lg:px-12 py-24 bg-[#f7f9fb]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <p className="text-xs font-semibold text-[#64748B] tracking-wide mb-2">
              Proven Impact
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#191c1e] tracking-tight mb-4 text-balance">
              Numbers That Drive Growth
            </h2>
            <p className="text-base text-[#64748B]">
              Real benchmarks achieved by local service businesses partnering
              with our system.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-8 rounded-xl border border-[#E2E8F0] hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-lg bg-[#e6e8ea] flex items-center justify-center text-black mb-6">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div className="text-5xl font-bold text-[#191c1e] mb-2 tabular-nums">
                +45%
              </div>
              <h3 className="text-lg font-semibold text-[#191c1e] mb-2">
                Local Visibility
              </h3>
              <p className="text-base text-[#64748B] leading-relaxed">
                Dominate Google Local Pack rankings for high-intent keywords in
                your exact service radius.
              </p>
            </div>

            <div className="bg-white p-8 rounded-xl border border-[#E2E8F0] hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-lg bg-[#e6e8ea] flex items-center justify-center text-black mb-6">
                <UserPlus className="w-6 h-6" />
              </div>
              <div className="text-5xl font-bold text-[#191c1e] mb-2 tabular-nums">
                2.4x
              </div>
              <h3 className="text-lg font-semibold text-[#191c1e] mb-2">
                More Inbound Leads
              </h3>
              <p className="text-base text-[#64748B] leading-relaxed">
                Convert casual browsers into booked appointments with
                friction-free multi-channel funnels.
              </p>
            </div>

            <div className="bg-white p-8 rounded-xl border border-[#E2E8F0] hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-lg bg-[#e6e8ea] flex items-center justify-center text-black mb-6">
                <Zap className="w-6 h-6" />
              </div>
              <div className="text-5xl font-bold text-[#191c1e] mb-2 tabular-nums">
                100%
              </div>
              <h3 className="text-lg font-semibold text-[#191c1e] mb-2">
                Automated Follow-ups
              </h3>
              <p className="text-base text-[#64748B] leading-relaxed">
                Instant SMS and email response sequences ensure zero missed
                leads, even after hours.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Value Proposition / Features Grid */}
      <section id="services" className="px-6 lg:px-12 py-24 bg-[#f2f4f6]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <p className="text-xs font-semibold text-[#64748B] tracking-wide mb-2">
              Tailored Solutions
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#191c1e] tracking-tight mb-4 text-balance">
              Everything {companyName} Needs to Win
            </h2>
            <p className="text-base text-[#64748B]">
              Our proprietary three-pillar engine built specifically for local
              market domination.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-8 rounded-xl border border-[#E2E8F0]">
              <div className="text-black mb-6">
                <Globe className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-semibold text-[#191c1e] mb-2">
                Local SEO Domination
              </h3>
              <p className="text-sm text-[#64748B] mb-6 leading-relaxed">
                Optimize your Google Business Profile, local citations, and
                geo-targeted landing pages to capture top-of-funnel search
                traffic.
              </p>
              <ul className="space-y-2.5 text-sm text-[#44474d]">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-black shrink-0" />
                  <span>Citation cleanup &amp; sync</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-black shrink-0" />
                  <span>Geo-grid rank tracking</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-black shrink-0" />
                  <span>Service area expansion</span>
                </li>
              </ul>
            </div>

            <div className="bg-white p-8 rounded-xl border border-[#E2E8F0]">
              <div className="text-black mb-6">
                <MessageSquareQuote className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-semibold text-[#191c1e] mb-2">
                Automated Review Generation
              </h3>
              <p className="text-sm text-[#64748B] mb-6 leading-relaxed">
                Turn satisfied clients into your best marketing asset with
                automated, personalized SMS and email review requests.
              </p>
              <ul className="space-y-2.5 text-sm text-[#44474d]">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-black shrink-0" />
                  <span>Post-service SMS sequences</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-black shrink-0" />
                  <span>Negative feedback interception</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-black shrink-0" />
                  <span>Automated review syndication</span>
                </li>
              </ul>
            </div>

            <div className="bg-white p-8 rounded-xl border border-[#E2E8F0]">
              <div className="text-black mb-6">
                <Filter className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-semibold text-[#191c1e] mb-2">
                High-Converting Funnels
              </h3>
              <p className="text-sm text-[#64748B] mb-6 leading-relaxed">
                Replace clunky contact forms with lightning-fast interactive
                quote calculators and instant booking flows.
              </p>
              <ul className="space-y-2.5 text-sm text-[#44474d]">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-black shrink-0" />
                  <span>Instant quote calculators</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-black shrink-0" />
                  <span>CRM integration &amp; tagging</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-black shrink-0" />
                  <span>2-way lead nurturing SMS</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof / Testimonial */}
      <section className="px-6 lg:px-12 py-24 bg-[#f7f9fb]">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white p-8 lg:p-12 rounded-xl shadow-md border border-[#E2E8F0] relative">
            <div className="absolute top-6 right-8 text-black/10 pointer-events-none">
              <Quote className="w-16 h-16" />
            </div>

            <div className="flex items-center gap-1 mb-6" aria-label="5 out of 5 stars">
              {[0, 1, 2, 3, 4].map((idx) => (
                <Star
                  key={idx}
                  className="w-5 h-5 text-amber-500 fill-amber-500"
                />
              ))}
            </div>

            <blockquote className="text-xl sm:text-2xl font-semibold text-[#191c1e] mb-6 leading-relaxed relative z-10">
              “We went from struggling for consistent leads to booking over 40
              roofing jobs a month without spending an extra dime on Google Ads.
              The automated review system alone changed our entire local
              reputation.”
            </blockquote>

            <div className="flex items-center gap-4">
              {!avatarImgFailed ? (
                <img
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCq5SAM2VaCnP7FoHsWbhETfBM8xFvzgBUv4xKQEga4WG7SmOiDOmxrlD9SvU3PG1NipmVhBCPo4uU6Pbvhs-nMS2yGWlvY0bnENngxcVRQL2CKyli21HH0Def5-zbhtiapSjio9bdmWGfKP4eAcEtxgzdB1fjYgTLcZvPNbib5W9Ih7B1jaCES1dqD6GL4cJLjwFFXHe0rjKv00tbbi2XAI0d8ahc4Kw3cjLNXTMTl"
                  alt="Marcus Vance, Owner of Vance Elite Exteriors"
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarImgFailed(true)}
                  className="w-12 h-12 rounded-full object-cover border border-[#E2E8F0]"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-[#0d1c32] text-white font-semibold flex items-center justify-center text-sm">
                  MV
                </div>
              )}
              <div>
                <div className="font-semibold text-[#191c1e]">Marcus Vance</div>
                <div className="text-sm text-[#64748B]">
                  Owner, Vance Elite Exteriors
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Booking / Contact Form Section */}
      <section id="booking" className="px-6 lg:px-12 py-24 bg-[#f2f4f6]">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-5 flex flex-col gap-5">
            <p className="text-xs font-semibold text-[#64748B] tracking-wide">
              Take Action
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#191c1e] tracking-tight text-balance">
              Schedule Your 15-Minute Strategy Call
            </h2>
            <p className="text-base text-[#64748B] leading-relaxed">
              Pick a time that works for your team. We will review your current
              local footprint live and map out a custom growth blueprint for{' '}
              {companyName}.
            </p>
            <div className="space-y-3 pt-1">
              <div className="flex items-center gap-2.5 text-sm text-[#191c1e]">
                <CheckCircle2 className="w-4 h-4 text-black shrink-0" />
                <span>No sales pressure or generic pitches</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm text-[#191c1e]">
                <CheckCircle2 className="w-4 h-4 text-black shrink-0" />
                <span>Custom local competitor analysis included</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm text-[#191c1e]">
                <CheckCircle2 className="w-4 h-4 text-black shrink-0" />
                <span>Actionable takeaways you can use immediately</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7">
            <form
              onSubmit={handleConfirmBooking}
              className="bg-white p-8 rounded-xl shadow-xl border border-[#E2E8F0]"
            >
              <h3 className="text-lg font-semibold text-[#191c1e] mb-6">
                Select Date &amp; Time
              </h3>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-[#191c1e] mb-2">
                    Available Dates (This Week)
                  </label>
                  <div className="grid grid-cols-3 gap-2.5">
                    {slots.dates.map((dateOpt) => {
                      const active = selectedDateId === dateOpt.id;
                      return (
                        <button
                          key={dateOpt.id}
                          type="button"
                          onClick={() => setSelectedDateId(dateOpt.id)}
                          className={`p-3 text-center rounded-lg border text-sm font-medium transition-colors ${
                            active
                              ? 'bg-black text-white border-black shadow-sm'
                              : 'bg-[#eceef0] text-[#191c1e] border-[#E2E8F0] hover:bg-black hover:text-white'
                          }`}
                        >
                          <div className="font-semibold">{dateOpt.label}</div>
                          <div className="text-xs opacity-80">
                            {dateOpt.dateText}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#191c1e] mb-2">
                    Select Time Slot ({slots.timezone})
                  </label>
                  <div className="grid grid-cols-3 gap-2.5">
                    {slots.timeSlots.map((slot) => {
                      const active = selectedTime === slot;
                      return (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setSelectedTime(slot)}
                          className={`py-2.5 px-3 text-center rounded-lg border text-sm font-mono-tabular transition-colors ${
                            active
                              ? 'bg-black text-white border-black font-semibold shadow-sm'
                              : 'bg-[#eceef0] text-[#191c1e] border-[#E2E8F0] hover:bg-black hover:text-white'
                          }`}
                        >
                          {slot}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label
                      htmlFor="booking-name"
                      className="block text-sm font-semibold text-[#191c1e] mb-1"
                    >
                      Your Name
                    </label>
                    <input
                      id="booking-name"
                      type="text"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      maxLength={BLUEPRINT_LIMITS.maxDisplayNameLength}
                      placeholder="John Smith"
                      className="w-full px-4 py-3 rounded-lg bg-[#f7f9fb] border border-[#E2E8F0] text-sm text-[#191c1e] focus:outline-none focus:ring-2 focus:ring-black"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="booking-email"
                        className="block text-sm font-semibold text-[#191c1e] mb-1"
                      >
                        Work Email
                      </label>
                      <input
                        id="booking-email"
                        type="email"
                        value={workEmail}
                        onChange={(e) => setWorkEmail(e.target.value)}
                        maxLength={BLUEPRINT_LIMITS.maxEmailLength}
                        placeholder="john@apexroofing.com"
                        className="w-full px-4 py-3 rounded-lg bg-[#f7f9fb] border border-[#E2E8F0] text-sm text-[#191c1e] focus:outline-none focus:ring-2 focus:ring-black"
                        required
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="booking-company"
                        className="block text-sm font-semibold text-[#191c1e] mb-1"
                      >
                        Company Name
                      </label>
                      <input
                        id="booking-company"
                        type="text"
                        value={bookingCompany}
                        onChange={(e) => setBookingCompany(e.target.value)}
                        maxLength={BLUEPRINT_LIMITS.maxCompanyNameLength}
                        placeholder="Apex Roofing"
                        className="w-full px-4 py-3 rounded-lg bg-[#f7f9fb] border border-[#E2E8F0] text-sm text-[#191c1e] focus:outline-none focus:ring-2 focus:ring-black"
                      />
                    </div>
                  </div>
                </div>

                {bookingError && (
                  <div className="p-3.5 rounded-lg bg-[#ffdad6] text-[#93000a] text-sm font-medium">
                    {bookingError}
                  </div>
                )}

                {confirmedCode && (
                  <div className="p-4 rounded-lg bg-[#f2f4f6] border border-[#00677d]/30 text-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[#00677d]">
                        Strategy Call Scheduled
                      </span>
                      <span className="font-mono-tabular font-bold text-[#191c1e]">
                        {confirmedCode}
                      </span>
                    </div>
                    <p className="text-[#44474d]">
                      Booked for {selectedDateObj.fullLabel} at {selectedTime}{' '}
                      ({slots.timezone}). Manage or reschedule anytime in your
                      portal.
                    </p>
                    <button
                      type="button"
                      onClick={() => onNavigate('portal')}
                      className="text-xs font-semibold text-[#00677d] hover:underline"
                    >
                      Open Client Portal →
                    </button>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={bookingBusy}
                  className="w-full bg-black text-white text-sm font-semibold py-4 rounded-lg hover:bg-[#515f78] disabled:opacity-60 transition-colors shadow-md"
                >
                  {bookingBusy
                    ? 'Confirming Strategy Call...'
                    : user
                      ? 'Confirm 15-Minute Strategy Call'
                      : 'Verify with Google & Confirm Call'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* Quiet Footer */}
      <footer className="w-full bg-[#f2f4f6] border-t border-[#E2E8F0] py-12">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-black" />
            <span className="font-semibold text-[#191c1e]">ACME CORP</span>
          </div>
          <p className="text-sm text-[#64748B]">
            © {new Date().getFullYear()} Acme Corp. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => onNavigate('login')}
              className="text-sm text-[#64748B] hover:text-[#191c1e] transition-colors"
            >
              Client &amp; Admin Login
            </button>
            <button
              type="button"
              onClick={() => onNavigate('landing', 'booking')}
              className="text-sm text-[#64748B] hover:text-[#191c1e] transition-colors"
            >
              Book Strategy Call
            </button>
          </div>
        </div>
      </footer>

      {showWalkthrough && (
        <WalkthroughModal
          companyName={companyName}
          onClose={() => setShowWalkthrough(false)}
          onBookCall={() => onNavigate('landing', 'booking')}
        />
      )}
    </div>
  );
}
