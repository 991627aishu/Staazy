import React, { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Bell,
  CalendarCheck,
  Compass,
  Home,
  IndianRupee,
  LogOut,
  Menu,
  MessageSquare,
  Search,
  Sparkles,
  User,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { StaazyLogo } from '../components/StaazyLogo';
import { ConnectionBanner } from '../components/ConnectionBanner';
import { useAuth } from '../context/AuthContext';

const PRIMARY_NAV = [
  { to: '/tenant/discover', label: 'Discover', icon: Search },
  { to: '/tenant/roomies', label: 'Roomies', icon: Users },
  { to: '/tenant/mypg', label: 'MY PG', icon: Home },
  { to: '/tenant/rent', label: 'Rent', icon: IndianRupee },
  { to: '/tenant/explore', label: 'Explore', icon: Compass },
];

const SECONDARY_NAV = [
  { to: '/tenant/home', label: 'Overview', icon: Home },
  { to: '/tenant/pg-mates', label: 'PG Mates', icon: Users },
  { to: '/tenant/bookings', label: 'Bookings & Visits', icon: CalendarCheck },
  { to: '/tenant/chat', label: 'Chat', icon: MessageSquare },
  { to: '/tenant/complaints', label: 'Complaints', icon: Wrench },
  { to: '/tenant/onboarding/vibe', label: 'Vibe Calibration', icon: Sparkles },
  { to: '/tenant/notifications', label: 'Notifications', icon: Bell },
  { to: '/tenant/profile', label: 'Profile & Settings', icon: User },
];

export function TenantLayout() {
  const { user, previewMode, signOut } = useAuth();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/role-selection');
  };

  return (
    <div className="min-h-screen bg-[#FAF8FF] text-slate-900 flex flex-col">
      {/* Top Bar Contract: 3 clean zones separated by gap-8 */}
      <header className="sticky top-0 z-30 border-b border-[#E9E2FF] bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
          <Link to="/tenant/home" className="shrink-0">
            <StaazyLogo size="sm" />
          </Link>

          <nav className="hidden md:flex items-center gap-6" aria-label="Tenant primary navigation">
            {PRIMARY_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `text-sm font-semibold transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
                    isActive
                      ? 'border-[#6D28D9] text-[#2E1065]'
                      : 'border-transparent text-slate-600 hover:text-[#2E1065]'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <Menu className="h-4 w-4 text-[#6D28D9]" />
              <span>{user?.profile?.full_name?.split(' ')[0] || 'Menu'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Live Supabase Connection Banner */}
      <ConnectionBanner />

      {/* Secondary Utility Bar on Desktop */}
      <div className="hidden md:block border-b border-slate-200/80 bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-6 overflow-x-auto px-6 py-2.5 lg:px-8">
          {SECONDARY_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                    isActive ? 'text-[#6D28D9] font-semibold' : 'text-slate-500 hover:text-slate-900'
                  }`
                }
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 pb-24 sm:px-6 md:pb-12 lg:px-8">
        <Outlet />
      </main>

      {/* Mobile Bottom Tab Bar (Compact h-16 <= 15% mobile viewport) */}
      <nav
        aria-label="Mobile navigation"
        className="fixed bottom-0 inset-x-0 z-30 border-t border-slate-200 bg-white md:hidden"
      >
        <div className="grid h-16 grid-cols-5">
          {PRIMARY_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center gap-1 text-[11px] font-semibold ${
                    isActive ? 'text-[#6D28D9]' : 'text-slate-500'
                  }`
                }
              >
                <Icon className="h-5 w-5" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* Slide-over Account & Secondary Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-xs">
          <div className="flex h-full w-full max-w-xs flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <StaazyLogo size="sm" />
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <div className="mb-4 rounded-xl bg-[#F7F5FF] p-3.5 border border-[#E9E2FF]">
                <p className="text-sm font-bold text-[#2E1065]">
                  {user?.profile?.full_name || 'Staazy Tenant'}
                </p>
                <p className="mt-0.5 text-xs text-slate-600">
                  {user?.profile?.phone || user?.profile?.email || 'Unconnected UI Preview'}
                </p>
              </div>
              <div className="space-y-1">
                {[...PRIMARY_NAV, ...SECONDARY_NAV].map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setDrawerOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
                          isActive
                            ? 'bg-[#F7F5FF] text-[#6D28D9] font-semibold'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`
                      }
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
            <div className="border-t border-slate-200 p-4 space-y-2">
              <Link
                to="/role-selection"
                onClick={() => setDrawerOpen(false)}
                className="block w-full rounded-lg border border-slate-200 px-3.5 py-2 text-center text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Switch Portal
              </Link>
              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false);
                  void handleSignOut();
                }}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
