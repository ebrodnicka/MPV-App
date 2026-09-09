'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';

export default function HomePage() {
  const router = useRouter();

  const [loggedIn, setLoggedIn] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    checkSession();
  }, []);

  async function checkSession() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    setLoggedIn(Boolean(user));
    setCheckingSession(false);
  }

  return (
    <main className="min-h-screen bg-[#f4f8fc] text-[#153A5B]">
      {/* HEADER */}
      <header className="border-b border-[#dbe8f2] bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-xs font-bold tracking-[0.35em] text-[#4EA3E3]">
              MPV
            </p>

            <h1 className="text-xl font-bold text-[#153A5B]">
              Market Product Value
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {!checkingSession && loggedIn ? (
              <button
                onClick={() => router.push('/dashboard')}
                className="rounded-xl bg-[#17496D] px-5 py-3 font-bold text-white transition hover:opacity-90"
              >
                My Projects
              </button>
            ) : (
              <>
                <button
                  onClick={() => router.push('/login')}
                  className="rounded-xl px-5 py-3 font-semibold text-[#153A5B] transition hover:bg-[#f4f8fc]"
                >
                  Log in
                </button>

                <button
                  onClick={() => router.push('/register')}
                  className="rounded-xl border border-[#17496D] px-5 py-3 font-semibold text-[#17496D] transition hover:bg-[#f4f8fc]"
                >
                  Create account
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute -right-40 -top-40 h-[500px] w-[500px] rounded-full bg-[#d9effd] opacity-70" />
        <div className="absolute -left-40 top-[400px] h-[400px] w-[400px] rounded-full bg-[#e8f4fb]" />

        <div className="relative mx-auto grid max-w-7xl gap-14 px-6 py-20 lg:grid-cols-2 lg:items-center lg:py-28">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.3em] text-[#4EA3E3]">
              Analytical workspace
            </p>

            <h2 className="mt-6 max-w-3xl text-5xl font-bold leading-[1.08] text-[#153A5B] md:text-6xl">
              Compare products.
              <br />
              Make better decisions.
            </h2>

            <p className="mt-7 max-w-2xl text-lg leading-8 text-[#60788A]">
              Market Product Value helps you compare competing products using
              measurable criteria, weighted parameters and a structured
              evaluation process.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              {!checkingSession && loggedIn ? (
                <button
                  onClick={() => router.push('/dashboard')}
                  className="rounded-xl bg-[#17496D] px-7 py-4 font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  Go to My Projects →
                </button>
              ) : (
                <>
                  <button
                    onClick={() => router.push('/register')}
                    className="rounded-xl bg-[#17496D] px-7 py-4 font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    Start new analysis →
                  </button>

                  <button
                    onClick={() => router.push('/login')}
                    className="rounded-xl border border-[#cbdde9] bg-white px-7 py-4 font-bold text-[#153A5B] transition hover:bg-[#edf6fb]"
                  >
                    Log in
                  </button>
                </>
              )}
            </div>

            <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm text-[#60788A]">
              <span>✓ Structured comparison</span>
              <span>✓ Weighted criteria</span>
              <span>✓ Automatic ranking</span>
            </div>
          </div>

          {/* HERO CARD */}
          <div className="relative">
            <div className="rounded-[32px] border border-[#dbe8f2] bg-white p-6 shadow-xl shadow-[#17496D]/10 md:p-8">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#4EA3E3]">
                    Example analysis
                  </p>

                  <h3 className="mt-2 text-2xl font-bold text-[#153A5B]">
                    Product Comparison
                  </h3>
                </div>

                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef7fd] text-xl">
                  ↗
                </div>
              </div>

              <div className="mt-8 space-y-4">
                <ResultCard
                  position="01"
                  name="Product A"
                  score="86.4"
                  width="86%"
                />

                <ResultCard
                  position="02"
                  name="Product B"
                  score="74.1"
                  width="74%"
                />

                <ResultCard
                  position="03"
                  name="Product C"
                  score="61.8"
                  width="62%"
                />
              </div>

              <div className="mt-7 grid grid-cols-3 gap-3">
                <MiniCard label="Products" value="3" />
                <MiniCard label="Criteria" value="8" />
                <MiniCard label="Top score" value="86.4" />
              </div>
            </div>

            <div className="absolute -bottom-6 -left-6 hidden rounded-2xl border border-[#dbe8f2] bg-white p-5 shadow-lg md:block">
              <p className="text-xs text-[#60788A]">Evaluation complete</p>
              <p className="mt-1 font-bold text-[#153A5B]">
                Best option identified ✓
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.3em] text-[#4EA3E3]">
              Simple workflow
            </p>

            <h3 className="mt-4 text-4xl font-bold text-[#153A5B]">
              From criteria to final decision
            </h3>

            <p className="mt-4 text-lg text-[#60788A]">
              Complete four structured modules and receive a clear product
              ranking based on your own evaluation criteria.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            <StepCard
              number="01"
              title="Configuration"
              text="Define evaluation parameters, measurement units and their importance."
            />

            <StepCard
              number="02"
              title="Input Matrix"
              text="Add competing products and enter values for every parameter."
            />

            <StepCard
              number="03"
              title="Comparison"
              text="Automatically normalize the data and calculate weighted scores."
            />

            <StepCard
              number="04"
              title="Results"
              text="Review the final ranking and identify the strongest alternative."
            />
          </div>
        </div>
      </section>

      {/* WHY MPV */}
      <section className="bg-[#153A5B] text-white">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.3em] text-[#79c2f2]">
                Better comparison
              </p>

              <h3 className="mt-4 text-4xl font-bold">
                Turn different product characteristics into one clear result.
              </h3>

              <p className="mt-6 max-w-2xl text-lg leading-8 text-[#c9dce8]">
                MPV combines different units, priorities and product
                characteristics into a consistent scoring model that makes
                complex comparisons easier to understand.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FeatureCard
                title="Flexible criteria"
                text="Create parameters tailored to your specific analysis."
              />

              <FeatureCard
                title="Weighted evaluation"
                text="Control how strongly every criterion affects the final result."
              />

              <FeatureCard
                title="Automatic calculation"
                text="The application calculates normalized and weighted results."
              />

              <FeatureCard
                title="Clear ranking"
                text="See which product performs best and why."
              />
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#f4f8fc]">
        <div className="mx-auto max-w-5xl px-6 py-20 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-[#4EA3E3]">
            Ready to compare?
          </p>

          <h3 className="mt-4 text-4xl font-bold text-[#153A5B]">
            Start your first MPV analysis.
          </h3>

          <p className="mx-auto mt-4 max-w-2xl text-lg text-[#60788A]">
            Create a project, define your criteria and compare alternatives in
            one structured workspace.
          </p>

          <div className="mt-8">
            {!checkingSession && loggedIn ? (
              <button
                onClick={() => router.push('/dashboard')}
                className="rounded-xl bg-[#17496D] px-8 py-4 font-bold text-white"
              >
                Open My Projects →
              </button>
            ) : (
              <button
                onClick={() => router.push('/register')}
                className="rounded-xl bg-[#17496D] px-8 py-4 font-bold text-white"
              >
                Create free account →
              </button>
            )}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-[#dbe8f2] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 px-6 py-8 text-sm text-[#60788A] sm:flex-row sm:items-center">
          <div>
            <span className="font-bold text-[#153A5B]">
              Market Product Value
            </span>
            <span className="ml-2">MPV</span>
          </div>

          <p>Structured product evaluation workspace.</p>
        </div>
      </footer>
    </main>
  );
}

function ResultCard({
  position,
  name,
  score,
  width,
}: {
  position: string;
  name: string;
  score: string;
  width: string;
}) {
  return (
    <div className="rounded-2xl bg-[#f8fbfd] p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-sm font-bold text-[#4EA3E3]">
            {position}
          </div>

          <p className="font-bold text-[#153A5B]">{name}</p>
        </div>

        <p className="text-xl font-bold text-[#153A5B]">{score}</p>
      </div>

      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-[#e4edf3]">
        <div
          className="h-full rounded-full bg-[#4EA3E3]"
          style={{ width }}
        />
      </div>
    </div>
  );
}

function MiniCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-[#f8fbfd] p-4">
      <p className="text-xs text-[#60788A]">{label}</p>
      <p className="mt-1 text-xl font-bold text-[#153A5B]">{value}</p>
    </div>
  );
}

function StepCard({
  number,
  title,
  text,
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-3xl border border-[#dbe8f2] bg-[#f8fbfd] p-6">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#17496D] text-sm font-bold text-white">
        {number}
      </div>

      <h4 className="mt-6 text-xl font-bold text-[#153A5B]">
        {title}
      </h4>

      <p className="mt-3 leading-6 text-[#60788A]">{text}</p>
    </div>
  );
}

function FeatureCard({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl bg-white/10 p-6">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-[#9DD4FA]">
        ✓
      </div>

      <h4 className="mt-4 text-lg font-bold">{title}</h4>

      <p className="mt-2 text-sm leading-6 text-[#c9dce8]">
        {text}
      </p>
    </div>
  );
}