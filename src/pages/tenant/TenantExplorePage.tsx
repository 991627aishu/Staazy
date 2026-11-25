import React, { useState } from 'react';
import { Compass, MapPin, Phone, Star } from 'lucide-react';
import { EmptyState, ErrorState, LoadingSkeleton } from '../../components/ui/StateViews';
import { useAuth } from '../../context/AuthContext';
import { useAsyncData } from '../../hooks/useAsyncData';
import { fetchExploreNearby } from '../../services/operationsService';

export function TenantExplorePage() {
  const { isConfigured } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState('all');

  const exploreState = useAsyncData(
    () => fetchExploreNearby(selectedCategory),
    [selectedCategory],
    isConfigured
  );

  const categories = exploreState.data?.categories ?? [];
  const businesses = exploreState.data?.businesses ?? [];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold text-[#6D28D9]">Staazy Local Market</p>
        <h1 className="mt-1 text-2xl font-extrabold text-[#2E1065]">Explore Nearby Services</h1>
        <p className="mt-1 text-sm text-slate-600">
          Curated neighborhood tiffins, laundry services, gyms, and 24/7 reading rooms with exclusive perks for Staazy residents.
        </p>
      </div>

      {!isConfigured ? (
        <ErrorState notConfigured />
      ) : exploreState.loading ? (
        <LoadingSkeleton rows={4} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-[#6D28D9] text-white'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              All Services
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.slug)}
                className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
                  selectedCategory === cat.slug
                    ? 'bg-[#6D28D9] text-white'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {businesses.length === 0 ? (
            <EmptyState
              icon={<Compass className="h-5 w-5" />}
              title="No local partner listings in this category yet"
              description="Staazy Super Admins onboard verified neighborhood tiffins, laundries, and gyms through the Admin Explore Partnerships module."
            />
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {businesses.map((biz) => (
                <article key={biz.id} className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5">
                  <div>
                    <div className="flex items-start justify-between gap-2 text-xs">
                      <span className="font-semibold text-[#6D28D9]">
                        {biz.category?.name || 'Local Service'}
                        {biz.is_sponsored ? ' · Sponsored' : ''}
                      </span>
                      <span className="inline-flex items-center gap-1 font-mono font-bold text-slate-800">
                        <Star className="h-3.5 w-3.5 fill-[#FACC15] text-[#EAB308]" />
                        {Number(biz.rating_avg || 0).toFixed(1)}
                      </span>
                    </div>
                    <h2 className="mt-2 text-base font-bold text-slate-900">{biz.name}</h2>
                    <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                      <MapPin className="h-3.5 w-3.5" />
                      <span>
                        {biz.locality}, {biz.city}
                      </span>
                    </p>
                    {biz.description && (
                      <p className="mt-2.5 text-xs leading-relaxed text-slate-600">{biz.description}</p>
                    )}
                    {biz.staazy_perk && (
                      <div className="mt-3 rounded-xl bg-[#FAF8FF] border border-[#E9E2FF] px-3 py-2 text-xs font-semibold text-[#2E1065]">
                        Staazy Resident Perk: {biz.staazy_perk}
                      </div>
                    )}
                  </div>

                  {biz.phone && (
                    <a
                      href={`tel:${biz.phone}`}
                      className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      <span>Call {biz.phone}</span>
                    </a>
                  )}
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
