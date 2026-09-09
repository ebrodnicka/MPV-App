'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';

export default function NewProjectPage() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [currency, setCurrency] = useState('PLN');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function createProject(event: FormEvent) {
    event.preventDefault();

    setSaving(true);
    setError('');

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push('/login');
      return;
    }

    const { data, error } = await supabase
      .from('projects')
      .insert({
        user_id: user.id,
        name,
        category,
        currency,
        status: 'Draft',
        current_step: 'Configuration',
      })
      .select('id')
      .single();

    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }

    router.push(`/project/${data.id}/configuration`);
  }

  return (
    <main className="min-h-screen bg-[#f4f8fc]">
      <header className="border-b border-[#dbe8f2] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-xs font-bold tracking-[0.3em] text-[#4EA3E3]">
              MPV
            </p>

            <h1 className="text-xl font-bold text-[#153A5B]">
              Market Product Value
            </h1>
          </div>

          <button
            onClick={() => router.push('/dashboard')}
            className="rounded-xl border border-[#cbdde9] px-5 py-3 font-semibold text-[#153A5B]"
          >
            My Projects
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-6 py-14">
        <p className="text-sm font-bold tracking-[0.3em] text-[#4EA3E3]">
          NEW ANALYSIS
        </p>

        <h2 className="mt-4 text-4xl font-bold text-[#153A5B]">
          Create new project
        </h2>

        <p className="mt-3 text-[#60788A]">
          Set the basic information for your Market Product Value analysis.
        </p>

        <form
          onSubmit={createProject}
          className="mt-10 rounded-3xl bg-white p-8 shadow-lg"
        >
          <div>
            <label className="mb-2 block font-semibold text-[#153A5B]">
              Project name
            </label>

            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              placeholder="e.g. Smartphone market analysis"
              className="w-full rounded-xl border border-[#cbdde9] px-4 py-4 text-[#153A5B] outline-none"
            />
          </div>

          <div className="mt-6">
            <label className="mb-2 block font-semibold text-[#153A5B]">
              Product category
            </label>

            <input
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              required
              placeholder="e.g. Consumer electronics"
              className="w-full rounded-xl border border-[#cbdde9] px-4 py-4 text-[#153A5B] outline-none"
            />
          </div>

          <div className="mt-6">
            <label className="mb-2 block font-semibold text-[#153A5B]">
              Currency
            </label>

            <select
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
              className="w-full rounded-xl border border-[#cbdde9] bg-white px-4 py-4 text-[#153A5B] outline-none"
            >
              <option value="PLN">PLN</option>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
            </select>
          </div>

          {error && (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              className="flex-1 rounded-xl border border-[#cbdde9] px-5 py-4 font-semibold text-[#153A5B]"
            >
              ← Back
            </button>

            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-[#17496D] px-5 py-4 font-bold text-white disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create Project →'}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}