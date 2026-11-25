import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  LogOut,
  Plus,
  Settings,
  Shield,
  Sparkles,
  XCircle,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { BLUEPRINT_LIMITS, clampNumber, clampText } from '../lib/validation';
import type { AuditRecord, BookingRecord } from '../types/domain';
import type { ActiveRoute } from './Navbar';

interface ClientPortalProps {
  onNavigate: (route: ActiveRoute, sectionId?: string) => void;
}

type PortalTab = 'overview' | 'audit' | 'calls' | 'settings';

export function ClientPortal({ onNavigate }: ClientPortalProps) {
  const { user, userProfile, isAdmin, signOutUser, getAuthHeaders } = useAuth();
  const [activeTab, setActiveTab] = useState<PortalTab>('overview');

  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [audits, setAudits] = useState<AuditRecord[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Audit calculator state
  const [auditCompany, setAuditCompany] = useState('');
  const [auditCity, setAuditCity] = useState('Austin, TX');
  const [monthlyCalls, setMonthlyCalls] = useState('32');
  const [avgTicketValue, setAvgTicketValue] = useState('8500');
  const [monthlyAdSpend, setMonthlyAdSpend] = useState('3200');
  const [currentReviews, setCurrentReviews] = useState('44');
  const [auditBusy, setAuditBusy] = useState(false);
  const [auditMessage, setAuditMessage] = useState<string | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);

  // Profile settings state
  const [profileName, setProfileName] = useState('');
  const [profileCompany, setProfileCompany] = useState('');
  const [profileIndustry, setProfileIndustry] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  useEffect(() => {
    if (userProfile) {
      setAuditCompany(userProfile.companyName || 'Apex Roofing');
      setProfileName(userProfile.displayName || '');
      setProfileCompany(userProfile.companyName || '');
      setProfileIndustry(userProfile.industry || '');
      setProfilePhone(userProfile.phone || '');
    }
  }, [userProfile]);

  useEffect(() => {
    if (!user) return;
    setLoadingData(true);

    const toMillis = (ts: unknown): number => {
      if (
        ts &&
        typeof ts === 'object' &&
        'toMillis' in ts &&
        typeof (ts as { toMillis: () => number }).toMillis === 'function'
      ) {
        return (ts as { toMillis: () => number }).toMillis();
      }
      return 0;
    };

    const bookingsQuery = query(
      collection(db, 'bookings'),
      where('userId', '==', user.uid),
    );
    const unsubBookings = onSnapshot(
      bookingsQuery,
      (snap) => {
        const list = snap.docs
          .map((d) => ({
            id: d.id,
            ...(d.data() as Omit<BookingRecord, 'id'>),
          }))
          .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
        setBookings(list);
        setLoadingData(false);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'bookings');
      },
    );

    const auditsQuery = query(
      collection(db, 'audits'),
      where('userId', '==', user.uid),
    );
    const unsubAudits = onSnapshot(
      auditsQuery,
      (snap) => {
        const list = snap.docs
          .map((d) => ({
            id: d.id,
            ...(d.data() as Omit<AuditRecord, 'id'>),
          }))
          .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
        setAudits(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'audits');
      },
    );

    return () => {
      unsubBookings();
      unsubAudits();
    };
  }, [user]);

  if (!user || !userProfile) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-20 text-center">
        <p className="text-sm text-[#64748B]">Loading client portal...</p>
      </div>
    );
  }

  const isSuspended = userProfile.status === 'suspended';

  const handleRunAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuditError(null);
    setAuditMessage(null);

    if (isSuspended) {
      setAuditError('Suspended accounts cannot submit new growth audits.');
      return;
    }

    const cleanCompany = clampText(
      auditCompany,
      BLUEPRINT_LIMITS.maxCompanyNameLength,
    );
    const cleanCity = clampText(auditCity, BLUEPRINT_LIMITS.maxCityLength);
    if (!cleanCompany || !cleanCity) {
      setAuditError('Company name and service city are required.');
      return;
    }

    setAuditBusy(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/audit/calculate', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          companyName: cleanCompany,
          city: cleanCity,
          monthlyCalls: clampNumber(Number(monthlyCalls), 0, 100000),
          avgTicketValue: clampNumber(Number(avgTicketValue), 50, 1000000),
          monthlyAdSpend: clampNumber(Number(monthlyAdSpend), 0, 1000000),
          currentReviews: clampNumber(Number(currentReviews), 0, 100000),
        }),
      });

      const data = (await res.json()) as {
        error?: string;
        audit?: Omit<AuditRecord, 'id' | 'createdAt' | 'updatedAt'>;
      };
      if (!res.ok || !data.audit) {
        setAuditError(data.error || 'Failed to compute growth audit.');
        setAuditBusy(false);
        return;
      }

      const auditRef = doc(collection(db, 'audits'));
      const auditPath = `audits/${auditRef.id}`;
      try {
        await setDoc(auditRef, {
          ...data.audit,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (fsErr) {
        handleFirestoreError(fsErr, OperationType.CREATE, auditPath);
      }

      setAuditMessage(
        `Audit saved for ${cleanCompany}. Projected monthly uplift: +$${data.audit.projectedExtraRevenue.toLocaleString()}/mo.`,
      );
    } catch (err) {
      setAuditError(
        err instanceof Error ? err.message : 'Unable to generate audit.',
      );
    } finally {
      setAuditBusy(false);
    }
  };

  const handleCancelBooking = async (booking: BookingRecord) => {
    const bookingPath = `bookings/${booking.id}`;
    try {
      await updateDoc(doc(db, 'bookings', booking.id), {
        status: 'cancelled',
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, bookingPath);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsError(null);
    setSettingsSuccess(null);

    if (isSuspended) {
      setSettingsError('Suspended accounts cannot update profile settings.');
      return;
    }

    const cleanName = clampText(
      profileName,
      BLUEPRINT_LIMITS.maxDisplayNameLength,
    );
    const cleanCompany = clampText(
      profileCompany,
      BLUEPRINT_LIMITS.maxCompanyNameLength,
    );
    const cleanIndustry = clampText(
      profileIndustry,
      BLUEPRINT_LIMITS.maxIndustryLength,
    );
    const cleanPhone = clampText(profilePhone, BLUEPRINT_LIMITS.maxPhoneLength);

    if (!cleanName || !cleanCompany) {
      setSettingsError('Display name and company name are required.');
      return;
    }

    setSettingsBusy(true);
    const userPath = `users/${user.uid}`;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: cleanName,
        companyName: cleanCompany,
        industry: cleanIndustry,
        phone: cleanPhone,
        updatedAt: serverTimestamp(),
      });
      setSettingsSuccess(
        'Profile saved. Your personalized landing page metrics are now synced.',
      );
    } catch (err) {
      setSettingsError(
        err instanceof Error ? err.message : 'Unable to update profile.',
      );
      handleFirestoreError(err, OperationType.UPDATE, userPath);
    } finally {
      setSettingsBusy(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-[#f7f9fb] flex flex-col lg:flex-row">
      {/* Sidebar */}
      <aside className="w-full lg:w-64 bg-white border-b lg:border-b-0 lg:border-r border-[#E2E8F0] p-5 flex flex-col justify-between shrink-0">
        <div>
          <div className="mb-6 pb-4 border-b border-[#E2E8F0]">
            <p className="text-xs font-medium text-[#64748B]">Client Workspace</p>
            <h2 className="text-base font-bold text-[#191c1e] truncate">
              {userProfile.companyName}
            </h2>
            <p className="text-xs text-[#64748B] truncate mt-0.5">
              {userProfile.planTier} · {userProfile.status}
            </p>
          </div>

          <nav className="flex lg:flex-col gap-1 overflow-x-auto pb-1 lg:pb-0">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'overview'
                  ? 'bg-black text-white'
                  : 'text-[#44474d] hover:bg-[#f2f4f6]'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              Overview
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('audit')}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'audit'
                  ? 'bg-black text-white'
                  : 'text-[#44474d] hover:bg-[#f2f4f6]'
              }`}
            >
              <ClipboardCheck className="w-4 h-4" />
              Growth Audit
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('calls')}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'calls'
                  ? 'bg-black text-white'
                  : 'text-[#44474d] hover:bg-[#f2f4f6]'
              }`}
            >
              <Calendar className="w-4 h-4" />
              Strategy Calls ({bookings.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'settings'
                  ? 'bg-black text-white'
                  : 'text-[#44474d] hover:bg-[#f2f4f6]'
              }`}
            >
              <Settings className="w-4 h-4" />
              Account Settings
            </button>
          </nav>
        </div>

        <div className="hidden lg:flex flex-col gap-2 pt-6 border-t border-[#E2E8F0]">
          {isAdmin && (
            <button
              type="button"
              onClick={() => onNavigate('admin')}
              className="w-full inline-flex items-center justify-center gap-2 bg-[#00677d] text-white text-xs font-semibold py-2.5 px-3 rounded-lg hover:bg-[#004e5f] transition-colors"
            >
              <Shield className="w-3.5 h-3.5" />
              Switch to Admin Console
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigate('landing')}
            className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-[#44474d] hover:text-[#191c1e] py-2 border border-[#E2E8F0] rounded-lg"
          >
            View Public Page
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => signOutUser().then(() => onNavigate('landing'))}
            className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-[#93000a] hover:bg-[#ffdad6]/50 py-2 rounded-lg transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 p-6 lg:p-10 max-w-6xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <p className="text-xs font-medium text-[#64748B]">
              Client Portal / {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
            </p>
            <h1 className="text-2xl font-bold text-[#191c1e] tracking-tight">
              Welcome back, {userProfile.displayName}
            </h1>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setActiveTab('audit')}
              className="bg-black text-white text-xs font-semibold px-4 py-2.5 rounded-lg hover:bg-[#515f78] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              New Growth Audit
            </button>
            <button
              type="button"
              onClick={() => onNavigate('landing', 'booking')}
              className="bg-white border border-[#E2E8F0] text-[#191c1e] text-xs font-semibold px-4 py-2.5 rounded-lg hover:bg-[#f2f4f6] transition-colors whitespace-nowrap shrink-0"
            >
              Book Call
            </button>
          </div>
        </div>

        {isSuspended && (
          <div className="mb-6 p-4 rounded-xl bg-[#ffdad6] text-[#93000a] border border-[#93000a]/20 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-sm">
              <strong>Account Suspended:</strong> Your account is currently
              marked as suspended by an administrator. You can view historical
              data, while new submissions are paused.
            </div>
          </div>
        )}

        {activeTab === 'overview' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-xl border border-[#E2E8F0]">
                <p className="text-xs text-[#64748B] mb-1">
                  Projected Extra Revenue
                </p>
                <div className="text-2xl font-bold text-[#191c1e] font-mono-tabular">
                  ${userProfile.projectedRevenue.toLocaleString()}/mo
                </div>
              </div>
              <div className="bg-white p-5 rounded-xl border border-[#E2E8F0]">
                <p className="text-xs text-[#64748B] mb-1">
                  Inbound Call Target
                </p>
                <div className="text-2xl font-bold text-[#00677d] font-mono-tabular">
                  +{userProfile.inboundCallsGrowth}% MoM
                </div>
              </div>
              <div className="bg-white p-5 rounded-xl border border-[#E2E8F0]">
                <p className="text-xs text-[#64748B] mb-1">Saved Audits</p>
                <div className="text-2xl font-bold text-[#191c1e] font-mono-tabular">
                  {audits.length}
                </div>
              </div>
              <div className="bg-white p-5 rounded-xl border border-[#E2E8F0]">
                <p className="text-xs text-[#64748B] mb-1">Strategy Calls</p>
                <div className="text-2xl font-bold text-[#191c1e] font-mono-tabular">
                  {bookings.length}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-xl border border-[#E2E8F0]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-[#191c1e]">
                    Recent Growth Audits
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab('audit')}
                    className="text-xs font-semibold text-[#00677d] hover:underline"
                  >
                    Run Audit
                  </button>
                </div>

                {loadingData ? (
                  <div className="space-y-3">
                    <div className="h-14 rounded-lg bg-[#f2f4f6] animate-pulse" />
                    <div className="h-14 rounded-lg bg-[#f2f4f6] animate-pulse" />
                  </div>
                ) : audits.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-sm text-[#64748B] mb-3">
                      No growth audits computed yet.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('audit')}
                      className="text-xs font-semibold bg-black text-white px-4 py-2 rounded-lg"
                    >
                      Generate First Blueprint
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-[#E2E8F0]">
                    {audits.slice(0, 3).map((audit) => (
                      <div
                        key={audit.id}
                        className="py-3.5 flex items-center justify-between gap-4"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-[#191c1e] truncate">
                            {audit.companyName} · {audit.city}
                          </div>
                          <div className="text-xs text-[#64748B]">
                            Status: {audit.status.replace('_', ' ')} ·
                            Visibility {audit.visibilityScore}/100
                          </div>
                        </div>
                        <div className="text-sm font-bold text-[#00677d] font-mono-tabular shrink-0">
                          +${audit.projectedExtraRevenue.toLocaleString()}/mo
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white p-6 rounded-xl border border-[#E2E8F0]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-[#191c1e]">
                    Upcoming Strategy Calls
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab('calls')}
                    className="text-xs font-semibold text-[#00677d] hover:underline"
                  >
                    Manage Calls
                  </button>
                </div>

                {loadingData ? (
                  <div className="space-y-3">
                    <div className="h-14 rounded-lg bg-[#f2f4f6] animate-pulse" />
                    <div className="h-14 rounded-lg bg-[#f2f4f6] animate-pulse" />
                  </div>
                ) : bookings.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-sm text-[#64748B] mb-3">
                      No strategy calls scheduled yet.
                    </p>
                    <button
                      type="button"
                      onClick={() => onNavigate('landing', 'booking')}
                      className="text-xs font-semibold bg-black text-white px-4 py-2 rounded-lg"
                    >
                      Schedule 15-Min Call
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-[#E2E8F0]">
                    {bookings.slice(0, 3).map((booking) => (
                      <div
                        key={booking.id}
                        className="py-3.5 flex items-center justify-between gap-4"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-[#191c1e] truncate">
                            {booking.dateLabel} · {booking.timeSlot}
                          </div>
                          <div className="text-xs text-[#64748B] font-mono-tabular">
                            Code: {booking.confirmationCode}
                          </div>
                        </div>
                        <span className="text-xs font-semibold capitalize text-[#00677d] shrink-0">
                          {booking.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <form
              onSubmit={handleRunAudit}
              className="lg:col-span-5 bg-white p-6 rounded-xl border border-[#E2E8F0] space-y-4 h-fit"
            >
              <div>
                <h2 className="text-base font-bold text-[#191c1e]">
                  Local Growth Audit Engine
                </h2>
                <p className="text-xs text-[#64748B] mt-1">
                  Server-verified ROI calculation saved directly to your
                  Firebase record.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#191c1e] mb-1">
                  Company Name
                </label>
                <input
                  type="text"
                  value={auditCompany}
                  onChange={(e) => setAuditCompany(e.target.value)}
                  maxLength={BLUEPRINT_LIMITS.maxCompanyNameLength}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#f7f9fb] border border-[#E2E8F0] text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#191c1e] mb-1">
                  Primary Service City
                </label>
                <input
                  type="text"
                  value={auditCity}
                  onChange={(e) => setAuditCity(e.target.value)}
                  maxLength={BLUEPRINT_LIMITS.maxCityLength}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#f7f9fb] border border-[#E2E8F0] text-sm"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#191c1e] mb-1">
                    Monthly Calls
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100000}
                    value={monthlyCalls}
                    onChange={(e) => setMonthlyCalls(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#f7f9fb] border border-[#E2E8F0] text-sm font-mono-tabular"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#191c1e] mb-1">
                    Avg Ticket ($)
                  </label>
                  <input
                    type="number"
                    min={50}
                    max={1000000}
                    value={avgTicketValue}
                    onChange={(e) => setAvgTicketValue(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#f7f9fb] border border-[#E2E8F0] text-sm font-mono-tabular"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#191c1e] mb-1">
                    Monthly Ad Spend ($)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={1000000}
                    value={monthlyAdSpend}
                    onChange={(e) => setMonthlyAdSpend(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#f7f9fb] border border-[#E2E8F0] text-sm font-mono-tabular"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#191c1e] mb-1">
                    Google Reviews
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100000}
                    value={currentReviews}
                    onChange={(e) => setCurrentReviews(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#f7f9fb] border border-[#E2E8F0] text-sm font-mono-tabular"
                    required
                  />
                </div>
              </div>

              {auditError && (
                <div className="p-3 rounded-lg bg-[#ffdad6] text-[#93000a] text-xs font-medium">
                  {auditError}
                </div>
              )}
              {auditMessage && (
                <div className="p-3 rounded-lg bg-[#f2f4f6] border border-[#00677d]/30 text-[#00677d] text-xs font-medium">
                  {auditMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={auditBusy || isSuspended}
                className="w-full bg-black text-white text-sm font-semibold py-3 rounded-lg hover:bg-[#515f78] disabled:opacity-60 transition-colors"
              >
                {auditBusy ? 'Calculating Blueprint...' : 'Calculate & Save Audit'}
              </button>
            </form>

            <div className="lg:col-span-7 space-y-4">
              {audits.length === 0 ? (
                <div className="bg-white p-10 rounded-xl border border-[#E2E8F0] text-center">
                  <Sparkles className="w-6 h-6 text-[#00677d] mx-auto mb-3" />
                  <h3 className="text-base font-semibold text-[#191c1e] mb-1">
                    No saved audits yet
                  </h3>
                  <p className="text-sm text-[#64748B]">
                    Submit your numbers on the left to generate a personalized
                    90-day acquisition blueprint.
                  </p>
                </div>
              ) : (
                audits.map((audit) => (
                  <div
                    key={audit.id}
                    className="bg-white p-6 rounded-xl border border-[#E2E8F0] space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#E2E8F0]">
                      <div>
                        <h3 className="text-base font-bold text-[#191c1e]">
                          {audit.companyName} — {audit.city}
                        </h3>
                        <p className="text-xs text-[#64748B]">
                          Status: {audit.status.replace('_', ' ')} · Current
                          Reviews: {audit.currentReviews}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-[#00677d] font-mono-tabular">
                          +${audit.projectedExtraRevenue.toLocaleString()}/mo
                        </div>
                        <div className="text-xs text-[#64748B] font-mono-tabular">
                          +{audit.projectedCallsLiftPct}% call lift · Score{' '}
                          {audit.visibilityScore}/100
                        </div>
                      </div>
                    </div>

                    <ul className="space-y-2 text-sm text-[#44474d]">
                      {audit.recommendations.map((rec, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-[#00677d] shrink-0 mt-0.5" />
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>

                    {audit.adminNotes && (
                      <div className="p-3.5 rounded-lg bg-[#f7f9fb] border border-[#E2E8F0] text-xs text-[#191c1e]">
                        <span className="font-semibold">Strategist Note: </span>
                        {audit.adminNotes}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'calls' && (
          <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#191c1e]">
                Your Scheduled Strategy Calls
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('landing', 'booking')}
                className="text-xs font-semibold text-[#00677d] hover:underline"
              >
                + Schedule Another Call
              </button>
            </div>

            {bookings.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-sm text-[#64748B] mb-4">
                  You have not booked a strategy call yet.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate('landing', 'booking')}
                  className="bg-black text-white text-xs font-semibold px-4 py-2.5 rounded-lg"
                >
                  Select Date &amp; Time
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#f7f9fb] text-xs text-[#64748B] border-b border-[#E2E8F0]">
                    <tr>
                      <th className="py-3 px-6 font-semibold">Code</th>
                      <th className="py-3 px-6 font-semibold">Date &amp; Time</th>
                      <th className="py-3 px-6 font-semibold">Company</th>
                      <th className="py-3 px-6 font-semibold">Status</th>
                      <th className="py-3 px-6 font-semibold">Notes</th>
                      <th className="py-3 px-6 font-semibold text-right">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {bookings.map((b) => (
                      <tr key={b.id} className="hover:bg-[#f7f9fb]">
                        <td className="py-3.5 px-6 font-mono-tabular font-semibold text-[#191c1e]">
                          {b.confirmationCode}
                        </td>
                        <td className="py-3.5 px-6 text-[#191c1e]">
                          {b.dateLabel} · {b.timeSlot}
                        </td>
                        <td className="py-3.5 px-6 text-[#44474d]">
                          {b.companyName}
                        </td>
                        <td className="py-3.5 px-6 capitalize font-semibold text-[#00677d]">
                          {b.status}
                        </td>
                        <td className="py-3.5 px-6 text-xs text-[#64748B] max-w-xs truncate">
                          {b.notes || 'Pending strategist review'}
                        </td>
                        <td className="py-3.5 px-6 text-right">
                          {b.status !== 'completed' &&
                          b.status !== 'cancelled' ? (
                            <button
                              type="button"
                              onClick={() => handleCancelBooking(b)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-[#93000a] hover:underline"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Cancel
                            </button>
                          ) : (
                            <span className="text-xs text-[#64748B]">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <form
            onSubmit={handleSaveSettings}
            className="max-w-xl bg-white p-6 rounded-xl border border-[#E2E8F0] space-y-4"
          >
            <div>
              <h2 className="text-base font-bold text-[#191c1e]">
                Account &amp; Personalization Settings
              </h2>
              <p className="text-xs text-[#64748B] mt-1">
                Changes sync directly with your Firestore user record and
                personalize your ACME Corp landing experience.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#191c1e] mb-1">
                Account Email (Verified)
              </label>
              <input
                type="email"
                value={userProfile.email}
                disabled
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#eceef0] border border-[#E2E8F0] text-sm text-[#64748B]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#191c1e] mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                maxLength={BLUEPRINT_LIMITS.maxDisplayNameLength}
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#f7f9fb] border border-[#E2E8F0] text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#191c1e] mb-1">
                Company Name
              </label>
              <input
                type="text"
                value={profileCompany}
                onChange={(e) => setProfileCompany(e.target.value)}
                maxLength={BLUEPRINT_LIMITS.maxCompanyNameLength}
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#f7f9fb] border border-[#E2E8F0] text-sm"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#191c1e] mb-1">
                  Industry
                </label>
                <input
                  type="text"
                  value={profileIndustry}
                  onChange={(e) => setProfileIndustry(e.target.value)}
                  maxLength={BLUEPRINT_LIMITS.maxIndustryLength}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#f7f9fb] border border-[#E2E8F0] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#191c1e] mb-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={profilePhone}
                  onChange={(e) => setProfilePhone(e.target.value)}
                  maxLength={BLUEPRINT_LIMITS.maxPhoneLength}
                  placeholder="(555) 234-5678"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#f7f9fb] border border-[#E2E8F0] text-sm"
                />
              </div>
            </div>

            {settingsError && (
              <div className="p-3 rounded-lg bg-[#ffdad6] text-[#93000a] text-xs font-medium">
                {settingsError}
              </div>
            )}
            {settingsSuccess && (
              <div className="p-3 rounded-lg bg-[#f2f4f6] border border-[#00677d]/30 text-[#00677d] text-xs font-medium">
                {settingsSuccess}
              </div>
            )}

            <button
              type="submit"
              disabled={settingsBusy || isSuspended}
              className="bg-black text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-[#515f78] disabled:opacity-60 transition-colors"
            >
              {settingsBusy ? 'Saving...' : 'Save Account Changes'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
