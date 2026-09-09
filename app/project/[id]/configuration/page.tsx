'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';

type Parameter = {
  id?: string;
  clientId: string;
  name: string;
  unit: string;
  indicator_type: 'stimulant' | 'destimulant';
  weight: number;
};

export default function ConfigurationPage() {
  const params = useParams();
  const router = useRouter();

  const projectId = params.id as string;

  const [projectName, setProjectName] = useState('');
  const [projectCategory, setProjectCategory] = useState('');

  const [parameters, setParameters] = useState<Parameter[]>([]);
  const [originalIds, setOriginalIds] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadPage();
  }, [projectId]);

  async function loadPage() {
    setLoading(true);
    setError('');

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push('/login');
      return;
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('name, category')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (projectError || !project) {
      setError(projectError?.message || 'Project not found.');
      setLoading(false);
      return;
    }

    setProjectName(project.name);
    setProjectCategory(project.category || '');

    const { data: parameterData, error: parameterError } = await supabase
      .from('parameters')
      .select('id, name, unit, indicator_type, weight, sort_order')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true });

    if (parameterError) {
      setError(parameterError.message);
      setLoading(false);
      return;
    }

    const loadedParameters: Parameter[] = (parameterData || []).map(
      (parameter) => ({
        id: parameter.id,
        clientId: parameter.id,
        name: parameter.name || '',
        unit: parameter.unit || '',
        indicator_type:
          parameter.indicator_type === 'destimulant'
            ? 'destimulant'
            : 'stimulant',
        weight: parameter.weight || 5,
      })
    );

    setParameters(loadedParameters);
    setOriginalIds(loadedParameters.map((parameter) => parameter.id!));

    setLoading(false);
  }

  function addParameter() {
    setParameters((current) => [
      ...current,
      {
        clientId: `new-${Date.now()}-${Math.random()}`,
        name: '',
        unit: '',
        indicator_type: 'stimulant',
        weight: 5,
      },
    ]);
  }

  function updateParameter(
    clientId: string,
    field: keyof Parameter,
    value: string | number
  ) {
    setParameters((current) =>
      current.map((parameter) =>
        parameter.clientId === clientId
          ? {
              ...parameter,
              [field]: value,
            }
          : parameter
      )
    );
  }

  function removeParameter(clientId: string) {
    setParameters((current) =>
      current.filter((parameter) => parameter.clientId !== clientId)
    );
  }

  async function saveConfiguration() {
    setError('');
    setMessage('');

    if (parameters.length === 0) {
      setError('Add at least one parameter.');
      return;
    }

    const incomplete = parameters.some(
      (parameter) =>
        !parameter.name.trim() ||
        !parameter.unit.trim() ||
        parameter.weight < 1 ||
        parameter.weight > 10
    );

    if (incomplete) {
      setError('Complete all parameter fields before saving.');
      return;
    }

    setSaving(true);

    try {
      const existingIds = parameters
        .filter((parameter) => parameter.id)
        .map((parameter) => parameter.id as string);

      const deletedIds = originalIds.filter(
        (originalId) => !existingIds.includes(originalId)
      );

      if (deletedIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('parameters')
          .delete()
          .in('id', deletedIds);

        if (deleteError) {
          throw deleteError;
        }
      }

      for (let index = 0; index < parameters.length; index++) {
        const parameter = parameters[index];

        const payload = {
          project_id: projectId,
          name: parameter.name.trim(),
          unit: parameter.unit.trim(),
          indicator_type: parameter.indicator_type,
          weight: parameter.weight,
          sort_order: index + 1,
        };

        if (parameter.id) {
          const { error: updateError } = await supabase
            .from('parameters')
            .update(payload)
            .eq('id', parameter.id);

          if (updateError) {
            throw updateError;
          }
        } else {
          const { error: insertError } = await supabase
            .from('parameters')
            .insert(payload);

          if (insertError) {
            throw insertError;
          }
        }
      }

      const { error: projectError } = await supabase
        .from('projects')
        .update({
          current_step: 'Configuration',
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId);

      if (projectError) {
        throw projectError;
      }

      setMessage('Configuration saved successfully ✅');

      await loadPage();
    } catch (saveError: any) {
      setError(
        saveError?.message ||
          saveError?.details ||
          'Configuration could not be saved.'
      );
    } finally {
      setSaving(false);
    }
  }

  const totalWeight = parameters.reduce(
    (sum, parameter) => sum + parameter.weight,
    0
  );

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f8fc]">
        <p className="text-[#60788A]">Loading configuration...</p>
      </main>
    );
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

      <section className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-sm font-bold uppercase tracking-[0.3em] text-[#4EA3E3]">
          {projectCategory || 'MPV Analysis'}
        </p>

        <h2 className="mt-3 text-4xl font-bold text-[#153A5B]">
          {projectName}
        </h2>

        <div className="mt-8 overflow-x-auto rounded-2xl bg-white p-2 shadow-sm">
          <div className="flex min-w-[700px] gap-2">
            <div className="flex-1 rounded-xl bg-[#17496D] px-5 py-4 text-center font-bold text-white">
              1 &nbsp; Configuration
            </div>

            <div className="flex-1 rounded-xl px-5 py-4 text-center font-semibold text-[#60788A]">
              2 &nbsp; Input Matrix
            </div>

            <div className="flex-1 rounded-xl px-5 py-4 text-center font-semibold text-[#60788A]">
              3 &nbsp; Comparison
            </div>

            <div className="flex-1 rounded-xl px-5 py-4 text-center font-semibold text-[#60788A]">
              4 &nbsp; Results
            </div>
          </div>
        </div>

        <div className="mt-10">
          <p className="text-sm font-bold tracking-[0.3em] text-[#4EA3E3]">
            MODULE 1
          </p>

          <h3 className="mt-3 text-3xl font-bold text-[#153A5B]">
            Parameters & Weights
          </h3>

          <p className="mt-3 max-w-3xl text-[#60788A]">
            Define the technical criteria used to evaluate products. Assign
            each parameter a weight from 1 to 10 and specify whether higher or
            lower values are preferred.
          </p>
        </div>

        <button
          onClick={addParameter}
          className="mt-7 w-full rounded-xl bg-[#17496D] px-6 py-4 font-bold text-white"
        >
          + Add Parameter
        </button>

        <div className="mt-7 space-y-5">
          {parameters.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[#cbdde9] bg-white p-8 text-center">
              <p className="font-semibold text-[#153A5B]">
                No parameters added yet
              </p>

              <p className="mt-2 text-sm text-[#60788A]">
                Add the first criterion used to evaluate products.
              </p>
            </div>
          )}

          {parameters.map((parameter, index) => (
            <div
              key={parameter.clientId}
              className="rounded-3xl border border-[#dbe8f2] bg-white p-7 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-bold text-[#153A5B]">
                  Parameter {index + 1}
                </h4>

                <button
                  type="button"
                  onClick={() => removeParameter(parameter.clientId)}
                  className="rounded-lg px-3 py-2 text-sm font-semibold text-red-600"
                >
                  Remove
                </button>
              </div>

              <div className="mt-6">
                <label className="mb-2 block font-semibold text-[#153A5B]">
                  Parameter name
                </label>

                <input
                  value={parameter.name}
                  onChange={(event) =>
                    updateParameter(
                      parameter.clientId,
                      'name',
                      event.target.value
                    )
                  }
                  placeholder="e.g. Purchase price"
                  className="w-full rounded-xl border border-[#cbdde9] px-4 py-4 text-[#153A5B] outline-none"
                />
              </div>

              <div className="mt-5">
                <label className="mb-2 block font-semibold text-[#153A5B]">
                  Unit
                </label>

                <input
                  value={parameter.unit}
                  onChange={(event) =>
                    updateParameter(
                      parameter.clientId,
                      'unit',
                      event.target.value
                    )
                  }
                  placeholder="e.g. PLN"
                  className="w-full rounded-xl border border-[#cbdde9] px-4 py-4 text-[#153A5B] outline-none"
                />
              </div>

              <div className="mt-5">
                <label className="mb-2 block font-semibold text-[#153A5B]">
                  Indicator type
                </label>

                <select
                  value={parameter.indicator_type}
                  onChange={(event) =>
                    updateParameter(
                      parameter.clientId,
                      'indicator_type',
                      event.target.value
                    )
                  }
                  className="w-full rounded-xl border border-[#cbdde9] bg-white px-4 py-4 text-[#153A5B] outline-none"
                >
                  <option value="stimulant">
                    Stimulant — More is better
                  </option>

                  <option value="destimulant">
                    Destimulant — Less is better
                  </option>
                </select>
              </div>

              <div className="mt-6">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-[#153A5B]">
                    Weight
                  </label>

                  <span className="font-bold text-[#4EA3E3]">
                    {parameter.weight}/10
                  </span>
                </div>

                <input
                  type="range"
                  min="1"
                  max="10"
                  value={parameter.weight}
                  onChange={(event) =>
                    updateParameter(
                      parameter.clientId,
                      'weight',
                      Number(event.target.value)
                    )
                  }
                  className="mt-4 w-full"
                />

                <div className="mt-1 flex justify-between text-xs text-[#8AA0B0]">
                  <span>1</span>
                  <span>10</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {parameters.length > 0 && (
          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-[#dbe8f2] bg-white p-5">
              <p className="text-sm text-[#60788A]">Parameters</p>
              <p className="mt-2 text-3xl font-bold text-[#153A5B]">
                {parameters.length}
              </p>
            </div>

            <div className="rounded-2xl border border-[#dbe8f2] bg-white p-5">
              <p className="text-sm text-[#60788A]">Total weight</p>
              <p className="mt-2 text-3xl font-bold text-[#153A5B]">
                {totalWeight}
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-7 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {message && (
          <div className="mt-7 rounded-xl border border-green-200 bg-green-50 p-4 text-green-700">
            {message}
          </div>
        )}

        <div className="mt-8 border-t border-[#dbe8f2] pt-7">
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full rounded-xl border border-[#cbdde9] px-6 py-4 font-semibold text-[#153A5B]"
          >
            ← Back to Projects
          </button>

          <button
            onClick={saveConfiguration}
            disabled={saving}
            className="mt-3 w-full rounded-xl bg-[#17496D] px-6 py-4 font-bold text-white disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </section>
    </main>
  );
}