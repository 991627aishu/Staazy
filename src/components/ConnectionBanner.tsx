import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Database,
  RefreshCw,
  WifiOff,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function ConnectionBanner() {
  const { connectionStatus, refreshConnection } = useAuth();
  const [retrying, setRetrying] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await refreshConnection();
    } finally {
      setRetrying(false);
    }
  };

  if (!connectionStatus || connectionStatus.state === 'checking') {
    return null;
  }

  // When successfully connected, show a reassuring green verified status
  if (connectionStatus.state === 'connected') {
    if (dismissed) return null;
    return (
      <div className="border-b border-emerald-200 bg-emerald-50 text-emerald-900 transition-all">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-1.5 text-xs sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold">{connectionStatus.message}</span>
            <span className="hidden sm:inline text-emerald-700/80">
              (Live PostgreSQL &amp; Auth active)
            </span>
          </div>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="rounded p-0.5 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-900"
            title="Dismiss notification"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // Error / Warning states
  let bgColor = 'bg-amber-50 border-amber-200 text-amber-950';
  let Icon = AlertTriangle;

  if (connectionStatus.state === 'network_error') {
    bgColor = 'bg-red-50 border-red-200 text-red-950';
    Icon = WifiOff;
  } else if (connectionStatus.state === 'invalid_credentials') {
    bgColor = 'bg-red-50 border-red-200 text-red-950';
    Icon = AlertCircle;
  }

  return (
    <div className={`border-b ${bgColor}`}>
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-xs sm:px-6 lg:px-8">
        <div className="flex items-start sm:items-center gap-2.5 min-w-0">
          <Icon className="h-4 w-4 shrink-0 mt-0.5 sm:mt-0 text-current" />
          <div>
            <span className="font-bold">{connectionStatus.message}</span>
            {connectionStatus.details && (
              <span className="ml-1 text-slate-600 hidden md:inline">
                ({connectionStatus.details})
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleRetry}
            disabled={retrying}
            className="inline-flex items-center gap-1.5 rounded-md border border-current/20 bg-white/80 px-2.5 py-1 text-xs font-semibold hover:bg-white transition-colors"
          >
            <RefreshCw className={`h-3 w-3 ${retrying ? 'animate-spin' : ''}`} />
            {retrying ? 'Checking...' : 'Retry Connection'}
          </button>

          <Link
            to="/setup-guide"
            className="font-semibold underline underline-offset-2 hover:opacity-80"
          >
            Setup Guide
          </Link>
        </div>
      </div>
    </div>
  );
}
