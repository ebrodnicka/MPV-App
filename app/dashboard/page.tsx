'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';

type Project = {
  id: string;
  name: string;
  category: string | null;
  currency: string | null;
  status: string | null;
  current_step: string | null;
  created_at: string;
};

export default function DashboardPage() {
  const router = useRouter();

  const [userName, setUserName] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    setError('');

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push('/login');
      return;
    }

    const name =
      user.user_metadata?.full_name ||
      user.user_metadata?.username ||
      user.email ||
      'User';

    setUserName(name);

    const { data, error } = await supabase
      .from('projects')
      .select(
        'id, name, category, currency, status, current_step, created_at'
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setProjects(data || []);
    setLoading(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  const activeProjects = projects.filter(
    (project) => project.status !== 'Completed'
  ).length;

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
            onClick={handleLogout}
            className="rounded-xl border border-[#cbdde9] px-5 py-3 font-semibold text-[#153A5B]"
          >
            Log out
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <p className="text-sm font-bold tracking-[0.3em] text-[#4EA3E3]">
          ANALYTICAL WORKSPACE
        </p>

        <h2 className="mt-4 text-4xl font-bold text-[#153A5B]">
          My Projects
        </h2>

        <p className="mt-3 text-[#60788A]">
          Welcome, {userName}. Create and manage Market Product Value analyses.
        </p>

        <button
          onClick={() => router.push('/project/new')}
          className="mt-8 w-full rounded-xl bg-[#17496D] px-6 py-4 font-bold text-white"
        >
          + New Project
        </button>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-[#dbe8f2] bg-white p-6 shadow-sm">
            <p className="text-sm text-[#60788A]">Total projects</p>
            <p className="mt-2 text-3xl font-bold text-[#153A5B]">
              {projects.length}
            </p>
          </div>

          <div className="rounded-2xl border border-[#dbe8f2] bg-white p-6 shadow-sm">
            <p className="text-sm text-[#60788A]">Active analyses</p>
            <p className="mt-2 text-3xl font-bold text-[#153A5B]">
              {activeProjects}
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        <div className="mt-10">
          <h3 className="text-xl font-bold text-[#153A5B]">
            Projects
          </h3>

          {loading ? (
            <p className="mt-4 text-[#60788A]">Loading projects...</p>
          ) : projects.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-[#cbdde9] bg-white p-8 text-center">
              <p className="font-semibold text-[#153A5B]">
                No projects yet
              </p>

              <p className="mt-2 text-sm text-[#60788A]">
                Create your first MPV analysis to get started.
              </p>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="rounded-2xl border border-[#dbe8f2] bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
                    <div>
                      <p className="text-sm font-semibold text-[#4EA3E3]">
                        {project.status || 'Draft'}
                      </p>

                      <h4 className="mt-1 text-xl font-bold text-[#153A5B]">
                        {project.name}
                      </h4>

                      <p className="mt-2 text-sm text-[#60788A]">
                        {project.category || 'No category'}
                        {project.currency
                          ? ` • ${project.currency}`
                          : ''}
                      </p>

                      <p className="mt-2 text-xs text-[#8AA0B0]">
                        Current step:{' '}
                        {project.current_step || 'Configuration'}
                      </p>
                    </div>

                    <button
                      onClick={() =>
                        router.push(
                          `/project/${project.id}/configuration`
                        )
                      }
                      className="rounded-xl bg-[#17496D] px-5 py-3 font-semibold text-white"
                    >
                      Open Project
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}