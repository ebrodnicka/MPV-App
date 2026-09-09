'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push('/dashboard');
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
            onClick={() => router.push('/register')}
            className="rounded-xl border border-[#17496D] px-5 py-3 font-semibold text-[#17496D]"
          >
            Create account
          </button>
        </div>
      </header>

      <section className="mx-auto flex max-w-6xl justify-center px-6 py-16">
        <div className="w-full max-w-md rounded-3xl bg-white p-9 shadow-lg">
          <p className="text-sm font-bold tracking-[0.3em] text-[#4EA3E3]">
            LOG IN
          </p>

          <h2 className="mt-4 text-4xl font-bold text-[#153A5B]">
            Access your workspace
          </h2>

          <p className="mt-3 text-[#60788A]">
            Enter your account details to continue.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <div>
              <label className="mb-2 block font-semibold text-[#153A5B]">
                Email address
              </label>

              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                placeholder="name@example.com"
                className="w-full rounded-xl border border-[#cbdde9] px-4 py-4 text-[#153A5B] outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block font-semibold text-[#153A5B]">
                Password
              </label>

              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                placeholder="Your password"
                className="w-full rounded-xl border border-[#cbdde9] px-4 py-4 text-[#153A5B] outline-none"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#17496D] px-5 py-4 font-bold text-white disabled:opacity-50"
            >
              {loading ? 'Logging in...' : 'Log in'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[#60788A]">
            Don&apos;t have an account?{' '}
            <button
              onClick={() => router.push('/register')}
              className="font-semibold text-[#17496D]"
            >
              Create account
            </button>
          </p>
        </div>
      </section>
    </main>
  );
}