import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Lock,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import type { ActiveRoute } from './Navbar';

interface LoginViewProps {
  onNavigate: (route: ActiveRoute) => void;
}

export function LoginView({ onNavigate }: LoginViewProps) {
  const {
    user,
    userProfile,
    isAdmin,
    authBusy,
    authError,
    signInWithGoogle,
    signOutUser,
    clearAuthError,
  } = useAuth();
  const [loginMode, setLoginMode] = useState<'client' | 'admin'>('client');

  const handleGoogleSignIn = async () => {
    clearAuthError();
    const signedIn = await signInWithGoogle();
    if (signedIn) {
      // AuthContext listener populates profile & role; route immediately if bootstrap admin
      const isBootstrap =
        (signedIn.email || '').toLowerCase() === 'abdullahjavaid0307@gmail.com';
      if (loginMode === 'admin' && isBootstrap) {
        onNavigate('admin');
      } else {
        onNavigate('portal');
      }
    }
  };

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-[#f7f9fb] px-6 py-16 flex items-center justify-center">
      <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Left Info Panel */}
        <div className="lg:col-span-5 bg-[#0d1c32] text-white rounded-xl p-8 flex flex-col justify-between">
          <div>
            <button
              type="button"
              onClick={() => onNavigate('landing')}
              className="inline-flex items-center gap-2 text-xs font-medium text-white/75 hover:text-white transition-colors mb-8"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Overview
            </button>

            <h1 className="text-2xl font-bold tracking-tight mb-3 text-balance">
              {loginMode === 'admin'
                ? 'Executive Admin & User Database Console'
                : 'Client Growth & Audit Portal'}
            </h1>
            <p className="text-sm text-white/75 leading-relaxed mb-8">
              {loginMode === 'admin'
                ? 'Manage registered client accounts in Firebase, assign admin roles, review submitted growth audits, and oversee strategy call scheduling.'
                : 'Access your custom local SEO growth forecast, run backend-verified ROI audits, and manage your scheduled 15-minute strategy calls.'}
            </p>
          </div>

          <div className="space-y-3 border-t border-white/15 pt-6 text-xs text-white/85">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#50d9fe] shrink-0" />
              <span>Firebase Authentication &amp; server-verified tokens</span>
            </div>
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#50d9fe] shrink-0" />
              <span>Role-based access control enforced in Firestore</span>
            </div>
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#50d9fe] shrink-0" />
              <span>Real-time booking &amp; audit synchronization</span>
            </div>
          </div>
        </div>

        {/* Right Sign-In Card */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-[#E2E8F0] p-8 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1 p-1 bg-[#f2f4f6] rounded-lg border border-[#E2E8F0] mb-8">
              <button
                type="button"
                onClick={() => setLoginMode('client')}
                className={`flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-3 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                  loginMode === 'client'
                    ? 'bg-white text-[#191c1e] shadow-sm'
                    : 'text-[#64748B] hover:text-[#191c1e]'
                }`}
              >
                <Building2 className="w-4 h-4" />
                Client Login
              </button>
              <button
                type="button"
                onClick={() => setLoginMode('admin')}
                className={`flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-3 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                  loginMode === 'admin'
                    ? 'bg-white text-[#191c1e] shadow-sm'
                    : 'text-[#64748B] hover:text-[#191c1e]'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                Admin Login
              </button>
            </div>

            {user ? (
              <div className="space-y-6">
                <div className="p-4 rounded-lg bg-[#f7f9fb] border border-[#E2E8F0] flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[#191c1e] truncate">
                      {userProfile?.displayName || user.displayName || 'Signed In'}
                    </div>
                    <div className="text-xs text-[#64748B] truncate">
                      {user.email}
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-[#00677d] shrink-0">
                    {isAdmin ? 'Admin Role' : 'Client Role'}
                  </span>
                </div>

                {loginMode === 'admin' && !isAdmin && (
                  <div className="p-4 rounded-lg bg-[#ffdad6] text-[#93000a] text-sm">
                    This Google account currently has Client access. Sign in
                    with an authorized administrator account or ask an admin to
                    promote your UID in the User Database.
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3">
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => onNavigate('admin')}
                      className="flex-1 bg-black text-white text-sm font-semibold py-3 px-4 rounded-lg hover:bg-[#515f78] transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap"
                    >
                      Open Admin Console
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onNavigate('portal')}
                    className={`flex-1 text-sm font-semibold py-3 px-4 rounded-lg transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap ${
                      isAdmin
                        ? 'bg-[#e6e8ea] text-[#191c1e] hover:bg-[#d8dadc]'
                        : 'bg-black text-white hover:bg-[#515f78]'
                    }`}
                  >
                    Open Client Portal
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => signOutUser()}
                  disabled={authBusy}
                  className="w-full text-xs font-semibold text-[#64748B] hover:text-[#191c1e] py-2 transition-colors"
                >
                  Switch Google Account
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-[#191c1e] mb-2">
                    {loginMode === 'admin'
                      ? 'Sign in to Admin Console'
                      : 'Sign in to Client Portal'}
                  </h2>
                  <p className="text-sm text-[#64748B] leading-relaxed">
                    {loginMode === 'admin'
                      ? 'Authenticate with your verified Google administrator account to manage the Firebase user database, bookings, and audits.'
                      : 'Authenticate with Google to access your personalized growth metrics, save ROI audits, and track strategy calls.'}
                  </p>
                </div>

                {authError && (
                  <div className="p-3.5 rounded-lg bg-[#ffdad6] text-[#93000a] text-sm">
                    {authError}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={authBusy}
                  className="w-full bg-black text-white text-sm font-semibold py-3.5 px-5 rounded-lg hover:bg-[#515f78] disabled:opacity-60 transition-colors flex items-center justify-center gap-3 shadow-sm"
                >
                  <UserCheck className="w-4 h-4" />
                  {authBusy
                    ? 'Connecting to Firebase Auth...'
                    : `Continue with Google (${loginMode === 'admin' ? 'Admin' : 'Client'})`}
                </button>

                <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-[#f7f9fb] border border-[#E2E8F0] text-xs text-[#64748B]">
                  <Lock className="w-4 h-4 text-[#00677d] shrink-0 mt-0.5" />
                  <span>
                    Every session is verified server-side with Firebase ID
                    tokens and governed by role-scoped Firestore security rules.
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="pt-6 mt-8 border-t border-[#E2E8F0] flex items-center justify-between text-xs text-[#64748B]">
            <span>ACME Corp Identity Platform</span>
            <span>Protected by Firebase Auth</span>
          </div>
        </div>
      </div>
    </div>
  );
}
