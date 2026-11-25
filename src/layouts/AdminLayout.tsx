import React, { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Building2,
  Compass,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { StaazyLogo } from '../components/StaazyLogo';
import { useAuth } from '../context/AuthContext';

const ADMIN_NAV = [
  { to: '/admin/dashboard', label: 'Overview & Revenue', icon: LayoutDashboard },
  { to: '/admin/properties', label: 'PG Verification & Listings', icon: Building2 },
  { to: '/admin/owners', label: 'PG Owners', icon: ShieldCheck },
  { to: '/admin/tenants', label: 'Tenants', icon: Users },
  { to: '/admin/subscriptions', label: 'Subscriptions', icon: CreditCard },
  { to: '/admin/complaints', label: 'Escalated Complaints', icon: AlertTriangle },
  { to: '/admin/marketplace', label: 'Featured & Explore', icon: Compass },
  { to: '/admin/audit-logs', label: 'Audit Logs', icon: Activity },
  { to: '/admin/settings', label: 'Platform Settings', icon: Settings },
];

export function AdminLayout() {
  const { user, previewMode, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const currentNav = ADMIN_NAV.find((n) => location.pathname.startsWith(n.to));

  const handleSignOut = async () => {
    await signOut();
    navigate('/role-selection');
  };

  const SidebarContent = (
    <div className="flex h-full flex-col bg-[#0F172A] text-white">
      <div className="flex h-16 items-center justify-between border-b border-slate-800 px-5">
        <Link to="/admin/dashboard" onClick={() => setMobileOpen(false)} className="flex items-center gap-2">
          <StaazyLogo variant="light" size="sm" />
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label="Close sidebar"
          className="rounded-md p-1 text-slate-400 hover:bg-slate-800 lg:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="px-5 pt-4 pb-2">
        <p className="text-xs font-semibold text-[#FACC15]">Super Admin Console</p>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {ADMIN_NAV.map((item) => {
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
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          );
        })}
      </div>

      <div className="border-t border-slate-800 p-4 space-y-2.5">
        <div className="rounded-lg bg-slate-900 px-3 py-2.5 border border-slate-800">
          <p className="truncate text-xs font-semibold text-white">
            {user?.adminProfile?.title || user?.profile?.full_name || 'Super Admin'}
          </p>
          <p className="truncate text-[11px] text-slate-400">
            {user?.profile?.email || 'Role verified via PostgreSQL RLS'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/role-selection"
            className="flex-1 rounded-lg border border-slate-700 px-3 py-1.5 text-center text-xs font-medium text-slate-300 hover:bg-slate-800"
          >
            Portals
          </Link>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Exit</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:block lg:w-64">
        {SidebarContent}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="w-64 shrink-0">{SidebarContent}</div>
          <div className="flex-1 bg-slate-950/50" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              className="rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-50 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-sm text-slate-500 min-w-0">
              <span className="font-semibold text-slate-900 whitespace-nowrap">Staazy Admin</span>
              <span aria-hidden="true">/</span>
              <span className="truncate font-semibold text-[#6D28D9]">
                {currentNav?.label || 'Overview'}
              </span>
            </div>
          </div>

          <Link
            to="/setup-guide"
            className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            Database & RLS Guide
          </Link>
        </header>

        {previewMode && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-2">
            <span>
              <strong>Supabase not connected:</strong> Viewing Super Admin portal layout. In production, access is strictly enforced by PostgreSQL <code className="font-mono">user_roles</code> RLS.
            </span>
            <Link to="/setup-guide" className="font-semibold text-[#6D28D9] underline underline-offset-2 whitespace-nowrap">
              Connect Supabase
            </Link>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
