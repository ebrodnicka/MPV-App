'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';

export default function RegisterPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    setError('');
    setMessage('');

    if (password !== repeatPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!acceptedTerms) {
      setError('Please accept the Terms of Use.');
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          username,
        },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (!data.user) {
      setError('Unable to create account.');
      setLoading(false);
      return;
    }

    setMessage('Account created successfully ✅');

    setTimeout(() => {
      router.push('/login');
    }, 800);
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
            onClick={() => router.push('/login')}
            className="rounded-xl border border-[#17496D] px-5 py-3 font-semibold text-[#17496D]"
          >
            Log in
          </button>
        </div>
      </header>

      <section className="mx-auto flex max-w-6xl justify-center px-6 py-14">
        <div className="w-full max-w-lg rounded-3xl bg-white p-9 shadow-lg">
          <p className="text-sm font-bold tracking-[0.3em] text-[#4EA3E3]">
            CREATE ACCOUNT
          </p>

          <h2 className="mt-4 text-4xl font-bold text-[#153A5B]">
            Start using MPV
          </h2>

          <p className="mt-3 text-[#60788A]">
            Create your account to start building product analyses.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label className="mb-2 block font-semibold text-[#153A5B]">
                Full name
              </label>

              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
                placeholder="John Smith"
                className="w-full rounded-xl border border-[#cbdde9] px-4 py-4 text-[#153A5B] outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block font-semibold text-[#153A5B]">
                Username
              </label>

              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
                placeholder="john.smith"
                className="w-full rounded-xl border border-[#cbdde9] px-4 py-4 text-[#153A5B] outline-none"
              />
            </div>

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
                minLength={8}
                placeholder="Minimum 8 characters"
                className="w-full rounded-xl border border-[#cbdde9] px-4 py-4 text-[#153A5B] outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block font-semibold text-[#153A5B]">
                Repeat password
              </label>

              <input
                type="password"
                value={repeatPassword}
                onChange={(event) => setRepeatPassword(event.target.value)}
                required
                minLength={8}
                placeholder="Repeat your password"
                className="w-full rounded-xl border border-[#cbdde9] px-4 py-4 text-[#153A5B] outline-none"
              />
            </div>

            <label className="flex items-start gap-3 text-sm text-[#60788A]">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(event) => setAcceptedTerms(event.target.checked)}
                className="mt-1"
              />

              <span>
                I accept the Terms of Use and acknowledge the privacy
                requirements of the application.
              </span>
            </label>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            )}

            {message && (
              <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#17496D] px-5 py-4 font-bold text-white disabled:opacity-50"
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[#60788A]">
            Already have an account?{' '}
            <button
              onClick={() => router.push('/login')}
              className="font-semibold text-[#17496D]"
            >
              Log in
            </button>
          </p>
        </div>
      </section>
    </main>
  );
}