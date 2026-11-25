import React, { useState } from 'react';
import { Compass, Plus } from 'lucide-react';
import { EmptyState, ErrorState, LoadingSkeleton } from '../../components/ui/StateViews';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useAsyncData } from '../../hooks/useAsyncData';
import { createExploreBusiness, fetchAdminExploreBusinesses } from '../../services/adminService';
import { fetchExploreNearby } from '../../services/operationsService';

export function AdminMarketplacePage() {
  const { isConfigured } = useAuth();
  const { notify } = useToast();

  const [categoryId, setCategoryId] = useState('');
  const [name, setName] = useState('');
  const [locality, setLocality] = useState('');
  const [city, setCity] = useState('Bengaluru');
  const [phone, setPhone] = useState('');
  const [perk, setPerk] = useState('');
  const [description, setDescription] = useState('');
  const [isSponsored, setIsSponsored] = useState(false);
  const [saving, setSaving] = useState(false);

  const catsState = useAsyncData(() => fetchExploreNearby(), [], isConfigured);
  const bizState = useAsyncData(() => fetchAdminExploreBusinesses(), [], isConfigured);

  const categories = catsState.data?.categories ?? [];

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const cat = categoryId || categories[0]?.id;
    if (!cat) {
      notify('error', 'Categories Missing', 'Run supabase/seed.sql to seed explore_categories first.');
      return;
    }
    setSaving(true);
    try {
      await createExploreBusiness({
        category_id: cat,
        name,
        locality,
        city,
        phone,
        staazy_perk: perk,
        description,
        is_sponsored: isSponsored,
      });
      setName('');
      setLocality('');
      setPhone('');
      setPerk('');
      setDescription('');
      await bizState.reload();
      notify('success', 'Partner Business Added', 'Now visible in Tenant Explore Nearby.');
    } catch (err) {
      notify('error', 'Save Failed', err instanceof Error ? err.message : 'Unable to add business');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold text-[#6D28D9]">Staazy Local Market</p>
        <h1 className="mt-1 text-2xl font-extrabold text-slate-900">
          Explore Partnerships &amp; Local Businesses
        </h1>
      </div>

      {!isConfigured ? (
        <ErrorState notConfigured />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <form onSubmit={handleAdd} className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-[#6D28D9]" />
              <h2 className="text-sm font-bold text-slate-900">Add Explore Partner</h2>
            </div>

            <div>
              <label htmlFor="eb-cat" className="block text-xs font-semibold text-slate-700">
                Category
              </label>
              <select
                id="eb-cat"
                value={categoryId || categories[0]?.id || ''}
                onChange={(e) => setCategoryId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#6D28D9]"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="eb-name" className="block text-xs font-semibold text-slate-700">
                Business Name *
              </label>
              <input
                id="eb-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Koramangala Homely Tiffins"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm outline-none focus:border-[#6D28D9]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="eb-loc" className="block text-xs font-semibold text-slate-700">
                  Locality *
                </label>
                <input
                  id="eb-loc"
                  type="text"
                  required
                  value={locality}
                  onChange={(e) => setLocality(e.target.value)}
                  placeholder="Koramangala"
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#6D28D9]"
                />
              </div>
              <div>
                <label htmlFor="eb-city" className="block text-xs font-semibold text-slate-700">
                  City *
                </label>
                <input
                  id="eb-city"
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#6D28D9]"
                />
              </div>
            </div>

            <div>
              <label htmlFor="eb-perk" className="block text-xs font-semibold text-slate-700">
                Staazy Resident Perk
              </label>
              <input
                id="eb-perk"
                type="text"
                value={perk}
                onChange={(e) => setPerk(e.target.value)}
                placeholder="15% off monthly subscription with Staazy ID"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm outline-none focus:border-[#6D28D9]"
              />
            </div>

            <div>
              <label htmlFor="eb-phone" className="block text-xs font-semibold text-slate-700">
                Phone
              </label>
              <input
                id="eb-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-mono outline-none focus:border-[#6D28D9]"
              />
            </div>

            <div>
              <label htmlFor="eb-desc" className="block text-xs font-semibold text-slate-700">
                Description
              </label>
              <textarea
                id="eb-desc"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm outline-none focus:border-[#6D28D9]"
              />
            </div>

            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={isSponsored}
                onChange={(e) => setIsSponsored(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-[#6D28D9]"
              />
              <span>Sponsored Placement</span>
            </label>

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-[#6D28D9] py-2.5 text-sm font-bold text-white hover:bg-[#5B21B6] disabled:opacity-60"
            >
              {saving ? 'Adding Partner...' : 'Publish Explore Partner'}
            </button>
          </form>

          <section className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-base font-bold text-slate-900">
                Active Explore Partners ({bizState.data?.length ?? 0})
              </h2>
            </div>

            {bizState.loading ? (
              <div className="p-6">
                <LoadingSkeleton rows={4} />
              </div>
            ) : (bizState.data?.length ?? 0) === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={<Compass className="h-5 w-5" />}
                  title="No Explore partners added yet"
                  description="Onboard local tiffin, laundry, gym, and reading room partners to populate the Tenant Explore Nearby catalog."
                />
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {bizState.data!.map((b) => (
                  <div key={b.id} className="px-6 py-4 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold text-[#6D28D9]">
                        {b.category?.name}
                        {b.is_sponsored ? ' · Sponsored' : ''}
                      </p>
                      <p className="mt-0.5 text-sm font-bold text-slate-900">{b.name}</p>
                      <p className="text-xs text-slate-500">
                        {b.locality}, {b.city}
                      </p>
                      {b.staazy_perk && (
                        <p className="mt-1 text-xs font-medium text-emerald-700">{b.staazy_perk}</p>
                      )}
                    </div>
                    <span className="font-mono text-xs text-slate-500">{b.phone || '—'}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
