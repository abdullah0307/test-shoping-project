import {
  ArrowUpRight,
  Calendar,
  ClipboardCheck,
  Database,
  Edit3,
  LogOut,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  BLUEPRINT_LIMITS,
  clampNumber,
  clampText,
  isValidEmailFormat,
  sanitizeUserId,
} from '../lib/validation';
import type {
  AccountStatus,
  AuditRecord,
  AuditStatus,
  BookingRecord,
  BookingStatus,
  PlanTier,
  UserProfile,
  UserRole,
} from '../types/domain';
import type { ActiveRoute } from './Navbar';

interface AdminConsoleProps {
  onNavigate: (route: ActiveRoute, sectionId?: string) => void;
}

type AdminTab = 'users' | 'bookings' | 'audits';

const BOOTSTRAP_ADMIN_EMAIL = 'abdullahjavaid0307@gmail.com';

export function AdminConsole({ onNavigate }: AdminConsoleProps) {
  const { user, isAdmin, signOutUser } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('users');

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [audits, setAudits] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // User DB filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | AccountStatus>('all');

  // Booking & Audit filters
  const [bookingFilter, setBookingFilter] = useState<'all' | BookingStatus>('all');
  const [auditFilter, setAuditFilter] = useState<'all' | AuditStatus>('all');

  // Edit / Create User modal state
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [creatingUser, setCreatingUser] = useState(false);
  const [formUid, setFormUid] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formName, setFormName] = useState('');
  const [formCompany, setFormCompany] = useState('');
  const [formIndustry, setFormIndustry] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('user');
  const [formStatus, setFormStatus] = useState<AccountStatus>('active');
  const [formPlan, setFormPlan] = useState<PlanTier>('Growth Audit');
  const [formRevenue, setFormRevenue] = useState('48500');
  const [formCallsGrowth, setFormCallsGrowth] = useState('142');
  const [userFormBusy, setUserFormBusy] = useState(false);
  const [userFormError, setUserFormError] = useState<string | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<UserProfile | null>(null);

  // Editing Audit / Booking
  const [editingAudit, setEditingAudit] = useState<AuditRecord | null>(null);
  const [auditStatusDraft, setAuditStatusDraft] =
    useState<AuditStatus>('submitted');
  const [auditNotesDraft, setAuditNotesDraft] = useState('');

  const [editingBooking, setEditingBooking] = useState<BookingRecord | null>(
    null,
  );
  const [bookingStatusDraft, setBookingStatusDraft] =
    useState<BookingStatus>('pending');
  const [bookingNotesDraft, setBookingNotesDraft] = useState('');

  useEffect(() => {
    if (!user || !isAdmin) return;
    setLoading(true);

    const unsubUsers = onSnapshot(
      query(collection(db, 'users'), orderBy('createdAt', 'desc')),
      (snap) => {
        setUsers(snap.docs.map((d) => d.data() as UserProfile));
        setLoading(false);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'users'),
    );

    const unsubBookings = onSnapshot(
      query(collection(db, 'bookings'), orderBy('createdAt', 'desc')),
      (snap) => {
        setBookings(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<BookingRecord, 'id'>),
          })),
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'bookings'),
    );

    const unsubAudits = onSnapshot(
      query(collection(db, 'audits'), orderBy('createdAt', 'desc')),
      (snap) => {
        setAudits(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<AuditRecord, 'id'>),
          })),
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'audits'),
    );

    return () => {
      unsubUsers();
      unsubBookings();
      unsubAudits();
    };
  }, [user, isAdmin]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (statusFilter !== 'all' && u.status !== statusFilter) return false;
      if (!q) return true;
      return (
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.companyName.toLowerCase().includes(q)
      );
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) =>
      bookingFilter === 'all' ? true : b.status === bookingFilter,
    );
  }, [bookings, bookingFilter]);

  const filteredAudits = useMemo(() => {
    return audits.filter((a) =>
      auditFilter === 'all' ? true : a.status === auditFilter,
    );
  }, [audits, auditFilter]);

  if (!user || !isAdmin) {
    return (
      <div className="max-w-xl mx-auto px-6 py-24 text-center">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-8">
          <ShieldAlert className="w-8 h-8 text-[#93000a] mx-auto mb-3" />
          <h1 className="text-xl font-bold text-[#191c1e] mb-2">
            Administrator Access Required
          </h1>
          <p className="text-sm text-[#64748B] mb-6">
            You do not have administrator permissions for the Firebase User DB
            console.
          </p>
          <button
            type="button"
            onClick={() => onNavigate(user ? 'portal' : 'login')}
            className="bg-black text-white text-sm font-semibold px-5 py-2.5 rounded-lg"
          >
            {user ? 'Go to Client Portal' : 'Sign In'}
          </button>
        </div>
      </div>
    );
  }

  const openCreateModal = () => {
    setEditingUser(null);
    setCreatingUser(true);
    setFormUid(`client_${Date.now()}`);
    setFormEmail('');
    setFormName('');
    setFormCompany('');
    setFormIndustry('Home Services');
    setFormPhone('');
    setFormRole('user');
    setFormStatus('active');
    setFormPlan('Growth Audit');
    setFormRevenue('48500');
    setFormCallsGrowth('142');
    setUserFormError(null);
  };

  const openEditModal = (target: UserProfile) => {
    setCreatingUser(false);
    setEditingUser(target);
    setFormUid(target.uid);
    setFormEmail(target.email);
    setFormName(target.displayName);
    setFormCompany(target.companyName);
    setFormIndustry(target.industry);
    setFormPhone(target.phone);
    setFormRole(target.role);
    setFormStatus(target.status);
    setFormPlan(target.planTier);
    setFormRevenue(String(target.projectedRevenue));
    setFormCallsGrowth(String(target.inboundCallsGrowth));
    setUserFormError(null);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserFormError(null);

    const cleanName = clampText(formName, BLUEPRINT_LIMITS.maxDisplayNameLength);
    const cleanCompany = clampText(
      formCompany,
      BLUEPRINT_LIMITS.maxCompanyNameLength,
    );
    const cleanEmail = clampText(formEmail, BLUEPRINT_LIMITS.maxEmailLength);
    const cleanIndustry = clampText(
      formIndustry,
      BLUEPRINT_LIMITS.maxIndustryLength,
    );
    const cleanPhone = clampText(formPhone, BLUEPRINT_LIMITS.maxPhoneLength);
    const cleanRevenue = clampNumber(
      Number(formRevenue),
      0,
      BLUEPRINT_LIMITS.maxProjectedRevenue,
    );
    const cleanGrowth = clampNumber(
      Number(formCallsGrowth),
      0,
      BLUEPRINT_LIMITS.maxCallsGrowth,
    );

    if (!cleanName || !cleanCompany) {
      setUserFormError('Name and company name are required.');
      return;
    }

    setUserFormBusy(true);
    try {
      if (creatingUser) {
        if (!isValidEmailFormat(cleanEmail)) {
          setUserFormError('Enter a valid email address.');
          setUserFormBusy(false);
          return;
        }
        const safeUid = sanitizeUserId(formUid);
        const batch = writeBatch(db);
        const userRef = doc(db, 'users', safeUid);
        batch.set(userRef, {
          uid: safeUid,
          email: cleanEmail.toLowerCase(),
          displayName: cleanName,
          photoURL: '',
          role: formRole,
          status: formStatus,
          companyName: cleanCompany,
          industry: cleanIndustry,
          phone: cleanPhone,
          planTier: formPlan,
          projectedRevenue: cleanRevenue,
          inboundCallsGrowth: cleanGrowth,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        if (formRole === 'admin') {
          batch.set(doc(db, 'admins', safeUid), {
            uid: safeUid,
            email: cleanEmail.toLowerCase(),
            grantedBy: user.uid,
            createdAt: serverTimestamp(),
          });
        }

        try {
          await batch.commit();
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${safeUid}`);
        }
        setCreatingUser(false);
      } else if (editingUser) {
        const isSelf = editingUser.uid === user.uid;
        const isBootstrapTarget =
          editingUser.email.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL;
        if ((isSelf || isBootstrapTarget) && formRole !== 'admin') {
          setUserFormError(
            'Cannot demote the primary bootstrap admin or your own active admin session.',
          );
          setUserFormBusy(false);
          return;
        }
        if (isSelf && formStatus === 'suspended') {
          setUserFormError('You cannot suspend your own active admin account.');
          setUserFormBusy(false);
          return;
        }

        const batch = writeBatch(db);
        const userRef = doc(db, 'users', editingUser.uid);
        batch.update(userRef, {
          displayName: cleanName,
          photoURL: editingUser.photoURL || '',
          role: formRole,
          status: formStatus,
          companyName: cleanCompany,
          industry: cleanIndustry,
          phone: cleanPhone,
          planTier: formPlan,
          projectedRevenue: cleanRevenue,
          inboundCallsGrowth: cleanGrowth,
          updatedAt: serverTimestamp(),
        });

        const adminRef = doc(db, 'admins', editingUser.uid);
        if (formRole === 'admin' && editingUser.role !== 'admin') {
          batch.set(adminRef, {
            uid: editingUser.uid,
            email: editingUser.email,
            grantedBy: user.uid,
            createdAt: serverTimestamp(),
          });
        } else if (formRole === 'user' && editingUser.role === 'admin') {
          batch.delete(adminRef);
        }

        try {
          await batch.commit();
        } catch (err) {
          handleFirestoreError(
            err,
            OperationType.UPDATE,
            `users/${editingUser.uid}`,
          );
        }
        setEditingUser(null);
      }
    } finally {
      setUserFormBusy(false);
    }
  };

  const handleConfirmDeleteUser = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.uid === user.uid) return;
    const batch = writeBatch(db);
    batch.delete(doc(db, 'users', deleteTarget.uid));
    if (deleteTarget.role === 'admin') {
      batch.delete(doc(db, 'admins', deleteTarget.uid));
    }
    try {
      await batch.commit();
      setDeleteTarget(null);
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.DELETE,
        `users/${deleteTarget.uid}`,
      );
    }
  };

  const handleSaveBookingUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBooking) return;
    const path = `bookings/${editingBooking.id}`;
    try {
      await updateDoc(doc(db, 'bookings', editingBooking.id), {
        status: bookingStatusDraft,
        notes: clampText(bookingNotesDraft, BLUEPRINT_LIMITS.maxNotesLength),
        updatedAt: serverTimestamp(),
      });
      setEditingBooking(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const handleDeleteBooking = async (bookingId: string) => {
    const path = `bookings/${bookingId}`;
    try {
      await deleteDoc(doc(db, 'bookings', bookingId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const handleSaveAuditUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAudit) return;
    const path = `audits/${editingAudit.id}`;
    try {
      await updateDoc(doc(db, 'audits', editingAudit.id), {
        status: auditStatusDraft,
        adminNotes: clampText(
          auditNotesDraft,
          BLUEPRINT_LIMITS.maxAdminNotesLength,
        ),
        updatedAt: serverTimestamp(),
      });
      setEditingAudit(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const handleDeleteAudit = async (auditId: string) => {
    const path = `audits/${auditId}`;
    try {
      await deleteDoc(doc(db, 'audits', auditId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const totalPipeline = users.reduce(
    (sum, u) => sum + (Number(u.projectedRevenue) || 0),
    0,
  );
  const adminCount = users.filter((u) => u.role === 'admin').length;
  const activeCount = users.filter((u) => u.status === 'active').length;

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-[#f7f9fb] flex flex-col lg:flex-row">
      {/* Admin Sidebar */}
      <aside className="w-full lg:w-64 bg-[#0d1c32] text-white p-5 flex flex-col justify-between shrink-0">
        <div>
          <div className="mb-6 pb-4 border-b border-white/15">
            <p className="text-xs text-[#50d9fe] font-semibold">
              Admin Console
            </p>
            <h2 className="text-base font-bold truncate mt-0.5">
              Firebase User DB
            </h2>
            <p className="text-xs text-white/70 truncate mt-0.5">
              {user.email}
            </p>
          </div>

          <nav className="flex lg:flex-col gap-1 overflow-x-auto pb-1 lg:pb-0">
            <button
              type="button"
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'users'
                  ? 'bg-white text-[#0d1c32] font-semibold'
                  : 'text-white/80 hover:bg-white/10'
              }`}
            >
              <Database className="w-4 h-4" />
              User Database ({users.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('bookings')}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'bookings'
                  ? 'bg-white text-[#0d1c32] font-semibold'
                  : 'text-white/80 hover:bg-white/10'
              }`}
            >
              <Calendar className="w-4 h-4" />
              Strategy Calls ({bookings.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('audits')}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'audits'
                  ? 'bg-white text-[#0d1c32] font-semibold'
                  : 'text-white/80 hover:bg-white/10'
              }`}
            >
              <ClipboardCheck className="w-4 h-4" />
              Growth Audits ({audits.length})
            </button>
          </nav>
        </div>

        <div className="hidden lg:flex flex-col gap-2 pt-6 border-t border-white/15">
          <button
            type="button"
            onClick={() => onNavigate('portal')}
            className="w-full inline-flex items-center justify-center gap-2 bg-[#00677d] text-white text-xs font-semibold py-2.5 px-3 rounded-lg hover:bg-[#004e5f] transition-colors"
          >
            <Users className="w-3.5 h-3.5" />
            Client Portal View
          </button>
          <button
            type="button"
            onClick={() => onNavigate('landing')}
            className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-white/85 hover:text-white py-2 border border-white/20 rounded-lg"
          >
            Public Landing Page
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => signOutUser().then(() => onNavigate('landing'))}
            className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-[#ffdad6] hover:bg-white/10 py-2 rounded-lg transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 p-6 lg:p-10 max-w-7xl">
        {/* Top Summary Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-5 rounded-xl border border-[#E2E8F0]">
            <p className="text-xs text-[#64748B] mb-1">Registered Users</p>
            <div className="text-2xl font-bold text-[#191c1e] font-mono-tabular">
              {users.length}
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-[#E2E8F0]">
            <p className="text-xs text-[#64748B] mb-1">Active Accounts</p>
            <div className="text-2xl font-bold text-[#16A34A] font-mono-tabular">
              {activeCount}
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-[#E2E8F0]">
            <p className="text-xs text-[#64748B] mb-1">Administrators</p>
            <div className="text-2xl font-bold text-[#00677d] font-mono-tabular">
              {adminCount}
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-[#E2E8F0]">
            <p className="text-xs text-[#64748B] mb-1">
              Total Client Forecast
            </p>
            <div className="text-2xl font-bold text-[#191c1e] font-mono-tabular">
              ${totalPipeline.toLocaleString()}/mo
            </div>
          </div>
        </div>

        {/* Tab: Users DB */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
            <div className="p-5 border-b border-[#E2E8F0] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h1 className="text-lg font-bold text-[#191c1e]">
                  Firebase User Database Management
                </h1>
                <p className="text-xs text-[#64748B]">
                  Create, edit, promote/demote, suspend, or remove user records
                  in Firestore.
                </p>
              </div>
              <button
                type="button"
                onClick={openCreateModal}
                className="bg-black text-white text-xs font-semibold px-4 py-2.5 rounded-lg hover:bg-[#515f78] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 self-start lg:self-auto"
              >
                <Plus className="w-4 h-4" />
                Add Client Record
              </button>
            </div>

            <div className="px-5 py-3.5 bg-[#f7f9fb] border-b border-[#E2E8F0] flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name, email, or company..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-white border border-[#E2E8F0] text-xs text-[#191c1e] focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 p-1 bg-[#eceef0] rounded-lg">
                  {(['all', 'user', 'admin'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRoleFilter(r)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                        roleFilter === r
                          ? 'bg-white text-[#191c1e] shadow-sm'
                          : 'text-[#64748B] hover:text-[#191c1e]'
                      }`}
                    >
                      {r === 'all' ? 'All Roles' : r}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1 p-1 bg-[#eceef0] rounded-lg">
                  {(['all', 'active', 'suspended'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatusFilter(s)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                        statusFilter === s
                          ? 'bg-white text-[#191c1e] shadow-sm'
                          : 'text-[#64748B] hover:text-[#191c1e]'
                      }`}
                    >
                      {s === 'all' ? 'All Status' : s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {loading ? (
              <div className="p-8 space-y-3">
                <div className="h-10 rounded-lg bg-[#f2f4f6] animate-pulse" />
                <div className="h-10 rounded-lg bg-[#f2f4f6] animate-pulse" />
                <div className="h-10 rounded-lg bg-[#f2f4f6] animate-pulse" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-sm text-[#64748B]">
                  No user records match the current filter.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#f7f9fb] text-xs text-[#64748B] border-b border-[#E2E8F0]">
                    <tr>
                      <th className="py-3 px-5 font-semibold">User</th>
                      <th className="py-3 px-5 font-semibold">Company</th>
                      <th className="py-3 px-5 font-semibold">Role</th>
                      <th className="py-3 px-5 font-semibold">Tier</th>
                      <th className="py-3 px-5 font-semibold text-right">
                        Projected ROI
                      </th>
                      <th className="py-3 px-5 font-semibold">Status</th>
                      <th className="py-3 px-5 font-semibold text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {filteredUsers.map((u) => (
                      <tr key={u.uid} className="hover:bg-[#f7f9fb]">
                        <td className="py-3.5 px-5">
                          <div className="font-semibold text-[#191c1e]">
                            {u.displayName}
                          </div>
                          <div className="text-xs text-[#64748B]">
                            {u.email}
                          </div>
                        </td>
                        <td className="py-3.5 px-5">
                          <div className="text-[#191c1e] font-medium">
                            {u.companyName}
                          </div>
                          <div className="text-xs text-[#64748B]">
                            {u.industry || 'Local Services'}
                          </div>
                        </td>
                        <td className="py-3.5 px-5">
                          <span
                            className={`text-xs font-semibold capitalize ${
                              u.role === 'admin'
                                ? 'text-[#00677d]'
                                : 'text-[#44474d]'
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-xs text-[#44474d]">
                          {u.planTier}
                        </td>
                        <td className="py-3.5 px-5 text-right font-mono-tabular font-semibold text-[#191c1e]">
                          ${Number(u.projectedRevenue || 0).toLocaleString()}/mo
                        </td>
                        <td className="py-3.5 px-5">
                          <span
                            className={`text-xs font-semibold capitalize ${
                              u.status === 'active'
                                ? 'text-[#16A34A]'
                                : 'text-[#DC2626]'
                            }`}
                          >
                            {u.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openEditModal(u)}
                              aria-label={`Edit ${u.displayName}`}
                              className="p-1.5 rounded-md text-[#44474d] hover:bg-[#e6e8ea] transition-colors"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            {u.uid !== user.uid && (
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(u)}
                                aria-label={`Delete ${u.displayName}`}
                                className="p-1.5 rounded-md text-[#93000a] hover:bg-[#ffdad6] transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab: Bookings */}
        {activeTab === 'bookings' && (
          <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
            <div className="p-5 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-lg font-bold text-[#191c1e]">
                  Strategy Call Bookings
                </h1>
                <p className="text-xs text-[#64748B]">
                  Confirm, complete, or annotate incoming 15-minute strategy
                  calls.
                </p>
              </div>
              <div className="flex items-center gap-1 p-1 bg-[#eceef0] rounded-lg self-start">
                {(
                  ['all', 'pending', 'confirmed', 'completed', 'cancelled'] as const
                ).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setBookingFilter(st)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                      bookingFilter === st
                        ? 'bg-white text-[#191c1e] shadow-sm'
                        : 'text-[#64748B] hover:text-[#191c1e]'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {filteredBookings.length === 0 ? (
              <div className="p-10 text-center text-sm text-[#64748B]">
                No bookings match the selected status.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#f7f9fb] text-xs text-[#64748B] border-b border-[#E2E8F0]">
                    <tr>
                      <th className="py-3 px-5 font-semibold">Code</th>
                      <th className="py-3 px-5 font-semibold">Contact</th>
                      <th className="py-3 px-5 font-semibold">Company</th>
                      <th className="py-3 px-5 font-semibold">Slot</th>
                      <th className="py-3 px-5 font-semibold">Status</th>
                      <th className="py-3 px-5 font-semibold text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {filteredBookings.map((b) => (
                      <tr key={b.id} className="hover:bg-[#f7f9fb]">
                        <td className="py-3.5 px-5 font-mono-tabular font-semibold">
                          {b.confirmationCode}
                        </td>
                        <td className="py-3.5 px-5">
                          <div className="font-medium text-[#191c1e]">
                            {b.contactName}
                          </div>
                          <div className="text-xs text-[#64748B]">
                            {b.workEmail}
                          </div>
                        </td>
                        <td className="py-3.5 px-5 text-[#44474d]">
                          {b.companyName}
                        </td>
                        <td className="py-3.5 px-5 text-[#191c1e]">
                          {b.dateLabel} · {b.timeSlot}
                        </td>
                        <td className="py-3.5 px-5 capitalize font-semibold text-[#00677d]">
                          {b.status}
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingBooking(b);
                                setBookingStatusDraft(b.status);
                                setBookingNotesDraft(b.notes || '');
                              }}
                              className="p-1.5 rounded-md text-[#44474d] hover:bg-[#e6e8ea]"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteBooking(b.id)}
                              className="p-1.5 rounded-md text-[#93000a] hover:bg-[#ffdad6]"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab: Audits */}
        {activeTab === 'audits' && (
          <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
            <div className="p-5 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-lg font-bold text-[#191c1e]">
                  Client Growth Audits
                </h1>
                <p className="text-xs text-[#64748B]">
                  Review ROI calculations and publish strategist notes to client
                  portals.
                </p>
              </div>
              <div className="flex items-center gap-1 p-1 bg-[#eceef0] rounded-lg self-start">
                {(['all', 'submitted', 'in_review', 'blueprint_ready'] as const).map(
                  (st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setAuditFilter(st)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                        auditFilter === st
                          ? 'bg-white text-[#191c1e] shadow-sm'
                          : 'text-[#64748B] hover:text-[#191c1e]'
                      }`}
                    >
                      {st.replace('_', ' ')}
                    </button>
                  ),
                )}
              </div>
            </div>

            {filteredAudits.length === 0 ? (
              <div className="p-10 text-center text-sm text-[#64748B]">
                No growth audits match the selected filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#f7f9fb] text-xs text-[#64748B] border-b border-[#E2E8F0]">
                    <tr>
                      <th className="py-3 px-5 font-semibold">Company</th>
                      <th className="py-3 px-5 font-semibold text-right">
                        Score
                      </th>
                      <th className="py-3 px-5 font-semibold text-right">
                        Est. Uplift
                      </th>
                      <th className="py-3 px-5 font-semibold">Status</th>
                      <th className="py-3 px-5 font-semibold text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {filteredAudits.map((a) => (
                      <tr key={a.id} className="hover:bg-[#f7f9fb]">
                        <td className="py-3.5 px-5">
                          <div className="font-semibold text-[#191c1e]">
                            {a.companyName}
                          </div>
                          <div className="text-xs text-[#64748B]">{a.city}</div>
                        </td>
                        <td className="py-3.5 px-5 text-right font-mono-tabular">
                          {a.visibilityScore}/100
                        </td>
                        <td className="py-3.5 px-5 text-right font-mono-tabular font-semibold text-[#00677d]">
                          +${a.projectedExtraRevenue.toLocaleString()}/mo
                        </td>
                        <td className="py-3.5 px-5 capitalize font-semibold text-[#44474d]">
                          {a.status.replace('_', ' ')}
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingAudit(a);
                                setAuditStatusDraft(a.status);
                                setAuditNotesDraft(a.adminNotes || '');
                              }}
                              className="p-1.5 rounded-md text-[#44474d] hover:bg-[#e6e8ea]"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteAudit(a.id)}
                              className="p-1.5 rounded-md text-[#93000a] hover:bg-[#ffdad6]"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create / Edit User Modal */}
      {(creatingUser || editingUser) && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSaveUser}
            className="bg-white rounded-xl max-w-lg w-full p-6 border border-[#E2E8F0] shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2">
                <UserCog className="w-5 h-5 text-black" />
                <h3 className="text-base font-bold text-[#191c1e]">
                  {creatingUser ? 'Add Managed Client Record' : 'Edit User Record'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCreatingUser(false);
                  setEditingUser(null);
                }}
                className="p-1.5 rounded-lg text-[#64748B] hover:bg-[#f2f4f6]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {creatingUser && (
              <div>
                <label className="block text-xs font-semibold text-[#191c1e] mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  maxLength={BLUEPRINT_LIMITS.maxEmailLength}
                  placeholder="owner@apexroofing.com"
                  className="w-full px-3.5 py-2 rounded-lg bg-[#f7f9fb] border border-[#E2E8F0] text-sm"
                  required
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#191c1e] mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  maxLength={BLUEPRINT_LIMITS.maxDisplayNameLength}
                  className="w-full px-3.5 py-2 rounded-lg bg-[#f7f9fb] border border-[#E2E8F0] text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#191c1e] mb-1">
                  Company Name
                </label>
                <input
                  type="text"
                  value={formCompany}
                  onChange={(e) => setFormCompany(e.target.value)}
                  maxLength={BLUEPRINT_LIMITS.maxCompanyNameLength}
                  className="w-full px-3.5 py-2 rounded-lg bg-[#f7f9fb] border border-[#E2E8F0] text-sm"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#191c1e] mb-1">
                  Industry
                </label>
                <input
                  type="text"
                  value={formIndustry}
                  onChange={(e) => setFormIndustry(e.target.value)}
                  maxLength={BLUEPRINT_LIMITS.maxIndustryLength}
                  className="w-full px-3.5 py-2 rounded-lg bg-[#f7f9fb] border border-[#E2E8F0] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#191c1e] mb-1">
                  Phone
                </label>
                <input
                  type="text"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  maxLength={BLUEPRINT_LIMITS.maxPhoneLength}
                  className="w-full px-3.5 py-2 rounded-lg bg-[#f7f9fb] border border-[#E2E8F0] text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#191c1e] mb-1">
                  Role
                </label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 rounded-lg bg-[#f7f9fb] border border-[#E2E8F0] text-sm"
                >
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#191c1e] mb-1">
                  Status
                </label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as AccountStatus)}
                  className="w-full px-3 py-2 rounded-lg bg-[#f7f9fb] border border-[#E2E8F0] text-sm"
                >
                  <option value="active">active</option>
                  <option value="suspended">suspended</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#191c1e] mb-1">
                  Plan Tier
                </label>
                <select
                  value={formPlan}
                  onChange={(e) => setFormPlan(e.target.value as PlanTier)}
                  className="w-full px-3 py-2 rounded-lg bg-[#f7f9fb] border border-[#E2E8F0] text-sm"
                >
                  <option value="Growth Audit">Growth Audit</option>
                  <option value="Local Domination">Local Domination</option>
                  <option value="Enterprise">Enterprise</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#191c1e] mb-1">
                  Projected Extra Revenue ($/mo)
                </label>
                <input
                  type="number"
                  min={0}
                  max={10000000}
                  value={formRevenue}
                  onChange={(e) => setFormRevenue(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg bg-[#f7f9fb] border border-[#E2E8F0] text-sm font-mono-tabular"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#191c1e] mb-1">
                  Inbound Calls Growth (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={1000}
                  value={formCallsGrowth}
                  onChange={(e) => setFormCallsGrowth(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg bg-[#f7f9fb] border border-[#E2E8F0] text-sm font-mono-tabular"
                />
              </div>
            </div>

            {userFormError && (
              <div className="p-3 rounded-lg bg-[#ffdad6] text-[#93000a] text-xs font-medium">
                {userFormError}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setCreatingUser(false);
                  setEditingUser(null);
                }}
                className="px-4 py-2 rounded-lg border border-[#E2E8F0] text-xs font-semibold text-[#44474d]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={userFormBusy}
                className="px-5 py-2 rounded-lg bg-black text-white text-xs font-semibold hover:bg-[#515f78] disabled:opacity-60"
              >
                {userFormBusy ? 'Saving...' : 'Save User Record'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete User Confirm Modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-xl max-w-md w-full p-6 border border-[#E2E8F0] shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-[#191c1e]">
              Delete User Record?
            </h3>
            <p className="text-sm text-[#64748B]">
              Remove <strong>{deleteTarget.displayName}</strong> (
              {deleteTarget.email}) from the Firestore user database. This
              cannot be undone.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-lg border border-[#E2E8F0] text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteUser}
                className="px-4 py-2 rounded-lg bg-[#ba1a1a] text-white text-xs font-semibold"
              >
                Delete User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Booking Modal */}
      {editingBooking && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSaveBookingUpdate}
            className="bg-white rounded-xl max-w-md w-full p-6 border border-[#E2E8F0] shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#191c1e]">
                Update Booking {editingBooking.confirmationCode}
              </h3>
              <button
                type="button"
                onClick={() => setEditingBooking(null)}
                className="p-1.5 text-[#64748B]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#191c1e] mb-1">
                Status
              </label>
              <select
                value={bookingStatusDraft}
                onChange={(e) =>
                  setBookingStatusDraft(e.target.value as BookingStatus)
                }
                className="w-full px-3 py-2 rounded-lg bg-[#f7f9fb] border border-[#E2E8F0] text-sm"
              >
                <option value="pending">pending</option>
                <option value="confirmed">confirmed</option>
                <option value="completed">completed</option>
                <option value="cancelled">cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#191c1e] mb-1">
                Strategist Notes
              </label>
              <textarea
                rows={3}
                value={bookingNotesDraft}
                onChange={(e) => setBookingNotesDraft(e.target.value)}
                maxLength={BLUEPRINT_LIMITS.maxNotesLength}
                className="w-full px-3 py-2 rounded-lg bg-[#f7f9fb] border border-[#E2E8F0] text-sm"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingBooking(null)}
                className="px-4 py-2 rounded-lg border border-[#E2E8F0] text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-black text-white text-xs font-semibold"
              >
                Save Booking
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Audit Modal */}
      {editingAudit && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSaveAuditUpdate}
            className="bg-white rounded-xl max-w-md w-full p-6 border border-[#E2E8F0] shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#191c1e]">
                Review Audit: {editingAudit.companyName}
              </h3>
              <button
                type="button"
                onClick={() => setEditingAudit(null)}
                className="p-1.5 text-[#64748B]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#191c1e] mb-1">
                Review Status
              </label>
              <select
                value={auditStatusDraft}
                onChange={(e) =>
                  setAuditStatusDraft(e.target.value as AuditStatus)
                }
                className="w-full px-3 py-2 rounded-lg bg-[#f7f9fb] border border-[#E2E8F0] text-sm"
              >
                <option value="submitted">submitted</option>
                <option value="in_review">in_review</option>
                <option value="blueprint_ready">blueprint_ready</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#191c1e] mb-1">
                Strategist Recommendations
              </label>
              <textarea
                rows={4}
                value={auditNotesDraft}
                onChange={(e) => setAuditNotesDraft(e.target.value)}
                maxLength={BLUEPRINT_LIMITS.maxAdminNotesLength}
                className="w-full px-3 py-2 rounded-lg bg-[#f7f9fb] border border-[#E2E8F0] text-sm"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingAudit(null)}
                className="px-4 py-2 rounded-lg border border-[#E2E8F0] text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-black text-white text-xs font-semibold"
              >
                Save Review
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
