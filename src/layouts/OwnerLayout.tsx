import React, { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Building2,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  IndianRupee,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Plus,
  Receipt,
  Settings,
  UserCog,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { StaazyLogo } from '../components/StaazyLogo';
import { ConnectionBanner } from '../components/ConnectionBanner';
import { useAuth } from '../context/AuthContext';

const OWNER_NAV = [
  { to: '/owner/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/owner/properties', label: 'Properties & Rooms', icon: Building2 },
  { to: '/owner/applications', label: 'Applications', icon: ClipboardCheck },
  { to: '/owner/tenants', label: 'Tenants & Move-In/Out', icon: Users },
  { to: '/owner/daily-stays', label: 'Daily Stays', icon: CalendarDays },
  { to: '/owner/finance', label: 'Rent, UTR & Cash Claims', icon: IndianRupee },
  { to: '/owner/expenses', label: 'Expenses', icon: Receipt },
  { to: '/owner/complaints', label: 'Complaints', icon: Wrench },
  { to: '/owner/whatsapp', label: 'WhatsApp, Notices & Menu', icon: MessageCircle },
  { to: '/owner/team', label: 'My Team & Staff', icon: UserCog },
  { to: '/owner/reports', label: 'Reports & Analytics', icon: BarChart3 },
  { to: '/owner/subscription', label: 'Subscription Plans', icon: CreditCard },
  { to: '/owner/settings', label: 'PG OS Settings', icon: Settings },
];

export function OwnerLayout() {
  const { user, previewMode, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const currentNav = OWNER_NAV.find((n) => location.pathname.startsWith(n.to));

  const handleSignOut = async () => {
    await signOut();
    navigate('/role-selection');
  };

  const SidebarContent = (
    <div className="flex h-full flex-col bg-[#1E1B4B] text-white">
      <div className="flex h-16 items-center justify-between border-b border-white/10 px-5">
        <Link to="/owner/dashboard" onClick={() => setMobileOpen(false)}>
          <StaazyLogo variant="pgos" size="sm" />
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label="Close sidebar"
          className="rounded-md p-1 text-purple-200 hover:bg-white/10 lg:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {OWNER_NAV.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-[#6D28D9] text-white font-semibold'
                    : 'text-purple-100/80 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          );
        })}
      </div>

      <div className="border-t border-white/10 p-4 space-y-2.5">
        <div className="rounded-lg bg-white/5 px-3 py-2.5">
          <p className="truncate text-xs font-semibold text-white">
            {user?.ownerProfile?.business_name || user?.profile?.full_name || 'PG OS Operator'}
          </p>
          <p className="truncate text-[11px] text-purple-200/80">
            {user?.profile?.phone || user?.profile?.email || 'Unconnected Preview'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/role-selection"
            className="flex-1 rounded-lg border border-white/15 px-3 py-1.5 text-center text-xs font-medium text-purple-100 hover:bg-white/10"
          >
            Portals
          </Link>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-purple-100 hover:bg-white/10"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Exit</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8F7FC] text-slate-900 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:block lg:w-64">
        {SidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="w-64 shrink-0">{SidebarContent}</div>
          <div className="flex-1 bg-slate-950/50" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      {/* Main Workspace */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
              className="rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-50 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-sm text-slate-500 min-w-0">
              <span className="font-semibold text-[#2E1065] whitespace-nowrap">PG OS</span>
              <span aria-hidden="true">/</span>
              <span className="truncate font-semibold text-slate-900">
                {currentNav?.label || 'Workspace'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/owner/properties?action=create"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#6D28D9] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#5B21B6] transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>Add PG</span>
            </Link>
          </div>
        </header>

        {/* Live Supabase Connection Banner */}
        <ConnectionBanner />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
