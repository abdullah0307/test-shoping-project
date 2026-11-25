import { Layers, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export type ActiveRoute = 'landing' | 'login' | 'portal' | 'admin';

interface NavbarProps {
  activeRoute: ActiveRoute;
  onNavigate: (route: ActiveRoute, sectionId?: string) => void;
}

export function Navbar({ activeRoute, onNavigate }: NavbarProps) {
  const { user, isAdmin } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSectionClick = (sectionId: string) => {
    setMobileMenuOpen(false);
    onNavigate('landing', sectionId);
  };

  const handleRouteClick = (route: ActiveRoute) => {
    setMobileMenuOpen(false);
    onNavigate(route);
  };

  return (
    <header className="fixed top-0 w-full z-50 bg-[#f7f9fb]/90 backdrop-blur-xl border-b border-[#E2E8F0]">
      <div className="h-20 max-w-7xl mx-auto px-6 lg:px-12 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          type="button"
          onClick={() => handleRouteClick('landing')}
          className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black rounded-md px-1 py-1"
        >
          <Layers className="w-6 h-6 text-black shrink-0" />
          <span className="text-lg font-semibold tracking-tight text-[#191c1e] whitespace-nowrap shrink-0">
            ACME CORP
          </span>
        </button>

        {/* Zone 2: 4-5 Concise Single-Line Nav Links */}
        <nav className="hidden md:flex items-center gap-6">
          <button
            type="button"
            onClick={() => handleSectionClick('overview')}
            className={`text-sm font-medium px-3 py-2 rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              activeRoute === 'landing'
                ? 'bg-black text-white font-semibold'
                : 'text-[#44474d] hover:text-[#191c1e]'
            }`}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => handleSectionClick('results')}
            className="text-sm font-medium text-[#44474d] hover:text-[#191c1e] px-2 py-2 transition-colors whitespace-nowrap shrink-0"
          >
            Results
          </button>
          <button
            type="button"
            onClick={() => handleSectionClick('services')}
            className="text-sm font-medium text-[#44474d] hover:text-[#191c1e] px-2 py-2 transition-colors whitespace-nowrap shrink-0"
          >
            Services
          </button>
          <button
            type="button"
            onClick={() => handleSectionClick('booking')}
            className="text-sm font-medium text-[#44474d] hover:text-[#191c1e] px-2 py-2 transition-colors whitespace-nowrap shrink-0"
          >
            Contact
          </button>
          {user ? (
            <button
              type="button"
              onClick={() => handleRouteClick(isAdmin ? 'admin' : 'portal')}
              className={`text-sm font-semibold px-3 py-2 rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                activeRoute === 'portal' || activeRoute === 'admin'
                  ? 'bg-[#00677d] text-white'
                  : 'text-[#00677d] hover:bg-[#e6e8ea]'
              }`}
            >
              {isAdmin ? 'Admin Console' : 'Client Portal'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleRouteClick('login')}
              className={`text-sm font-semibold px-3 py-2 rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                activeRoute === 'login'
                  ? 'bg-[#e6e8ea] text-[#191c1e]'
                  : 'text-[#00677d] hover:text-[#191c1e]'
              }`}
            >
              Sign In
            </button>
          )}
        </nav>

        {/* Zone 3: 1 Primary CTA */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => handleSectionClick('booking')}
            className="hidden sm:inline-flex items-center justify-center bg-black text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-[#515f78] transition-colors shadow-sm whitespace-nowrap shrink-0"
          >
            Book a Call
          </button>
          <button
            type="button"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="md:hidden p-2 rounded-lg text-[#191c1e] hover:bg-[#e6e8ea] transition-colors"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-[#E2E8F0] px-6 py-4 flex flex-col gap-2 shadow-sm">
          <button
            type="button"
            onClick={() => handleSectionClick('overview')}
            className="text-left text-sm font-medium text-[#191c1e] py-2"
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => handleSectionClick('results')}
            className="text-left text-sm font-medium text-[#44474d] py-2"
          >
            Results
          </button>
          <button
            type="button"
            onClick={() => handleSectionClick('services')}
            className="text-left text-sm font-medium text-[#44474d] py-2"
          >
            Services
          </button>
          <button
            type="button"
            onClick={() => handleSectionClick('booking')}
            className="text-left text-sm font-medium text-[#44474d] py-2"
          >
            Contact
          </button>
          <button
            type="button"
            onClick={() =>
              handleRouteClick(user ? (isAdmin ? 'admin' : 'portal') : 'login')
            }
            className="text-left text-sm font-semibold text-[#00677d] py-2"
          >
            {user ? (isAdmin ? 'Admin Console' : 'Client Portal') : 'Sign In'}
          </button>
          <button
            type="button"
            onClick={() => handleSectionClick('booking')}
            className="mt-2 w-full bg-black text-white text-sm font-semibold py-2.5 rounded-lg"
          >
            Book a Call
          </button>
        </div>
      )}
    </header>
  );
}
