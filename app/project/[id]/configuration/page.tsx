'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import supabase from '../../../../lib/supabase';

type Parameter = {
  id: string;
  name: string;
  unit: string;
  indicator_type: 'stimulant' | 'destimulant';
  weight: number;
  sort_order: number;
};

type ComparisonMap = Record<string, number>;

export default function ConfigurationPage() {
  const params = useParams();
  const router = useRouter();

  const projectId = params.id as string;

  const [projectName, setProjectName] = useState('');

  const [parameters, setParameters] = useState<Parameter[]>([]);
  const [comparisons, setComparisons] = useState<ComparisonMap>({});

  const [newName, setNewName] = useState('');
  const [newUnit, setNewUnit] = useState('');
  const [newIndicatorType, setNewIndicatorType] =
    useState<'stimulant' | 'destimulant'>('stimulant');

  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadPage();
  }, [projectId]);

  function comparisonKey(rowId: string, columnId: string) {
    return `${rowId}__${columnId}`;
  }

  async function loadPage() {
    setLoading(true);
    setError('');

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('name')
        .eq('id', projectId)
        .single();

      if (projectError) throw projectError;

      setProjectName(project?.name ?? '');

      const { data: parameterRows, error: parameterError } = await supabase
        .from('parameters')
        .select(
          'id, name, unit, indicator_type, weight, sort_order'
        )
        .eq('project_id', projectId)
        .order('sort_order', { ascending: true });

      if (parameterError) throw parameterError;

      const loadedParameters: Parameter[] = (parameterRows ?? []).map(
        (row: any, index: number) => ({
          id: row.id,
          name: row.name ?? '',
          unit: row.unit ?? '',
          indicator_type:
            row.indicator_type === 'destimulant'
              ? 'destimulant'
              : 'stimulant',
          weight: Number(row.weight ?? 5),
          sort_order: Number(row.sort_order ?? index),
        })
      );

      setParameters(loadedParameters);

      const { data: comparisonRows, error: comparisonError } =
        await supabase
          .from('parameter_comparisons')
          .select(
            'parameter_row_id, parameter_column_id, value'
          )
          .eq('project_id', projectId);

      if (comparisonError) throw comparisonError;

      const loadedComparisons: ComparisonMap = {};

      (comparisonRows ?? []).forEach((row: any) => {
        loadedComparisons[
          comparisonKey(
            row.parameter_row_id,
            row.parameter_column_id
          )
        ] = Number(row.value);
      });

      setComparisons(loadedComparisons);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Configuration could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  async function addParameter() {
    setError('');
    setMessage('');

    if (!newName.trim()) {
      setError('Enter a parameter name.');
      return;
    }

    if (!newUnit.trim()) {
      setError('Enter a unit.');
      return;
    }

    setAdding(true);

    try {
      const nextOrder = parameters.length;

      const { data, error: insertError } = await supabase
        .from('parameters')
        .insert({
          project_id: projectId,
          name: newName.trim(),
          unit: newUnit.trim(),
          indicator_type: newIndicatorType,
          weight: 5,
          sort_order: nextOrder,
        })
        .select(
          'id, name, unit, indicator_type, weight, sort_order'
        )
        .single();

      if (insertError) throw insertError;

      const newParameter: Parameter = {
        id: data.id,
        name: data.name,
        unit: data.unit,
        indicator_type:
          data.indicator_type === 'destimulant'
            ? 'destimulant'
            : 'stimulant',
        weight: Number(data.weight ?? 5),
        sort_order: Number(data.sort_order ?? nextOrder),
      };

      setParameters((current) => [...current, newParameter]);

      setNewName('');
      setNewUnit('');
      setNewIndicatorType('stimulant');

      setMessage('Parameter added successfully.');
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Parameter could not be added.');
    } finally {
      setAdding(false);
    }
  }

  function updateParameter(
    id: string,
    field: 'name' | 'unit' | 'indicator_type',
    value: string
  ) {
    setParameters((current) =>
      current.map((parameter) =>
        parameter.id === id
          ? {
              ...parameter,
              [field]: value,
            }
          : parameter
      )
    );
  }

  async function deleteParameter(id: string) {
    setError('');
    setMessage('');

    try {
      const { error: deleteError } = await supabase
        .from('parameters')
        .delete()
        .eq('id', id)
        .eq('project_id', projectId);

      if (deleteError) throw deleteError;

      setParameters((current) =>
        current
          .filter((parameter) => parameter.id !== id)
          .map((parameter, index) => ({
            ...parameter,
            sort_order: index,
          }))
      );

      setComparisons((current) => {
        const next: ComparisonMap = {};

        Object.entries(current).forEach(([key, value]) => {
          if (!key.includes(id)) {
            next[key] = value;
          }
        });

        return next;
      });

      setMessage('Parameter removed.');
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Parameter could not be removed.');
    }
  }

  function getComparison(
    rowIndex: number,
    columnIndex: number
  ): number | null {
    if (rowIndex === columnIndex) {
      return null;
    }

    const row = parameters[rowIndex];
    const column = parameters[columnIndex];

    if (!row || !column) return null;

    if (rowIndex < columnIndex) {
      const value =
        comparisons[comparisonKey(row.id, column.id)];

      return value === undefined ? 0.5 : value;
    }

    const opposite =
      comparisons[comparisonKey(column.id, row.id)];

    if (opposite === undefined) {
      return 0.5;
    }

    if (opposite === 1) return 0;
    if (opposite === 0) return 1;

    return 0.5;
  }

  function setComparison(
    rowIndex: number,
    columnIndex: number,
    value: number
  ) {
    if (rowIndex === columnIndex) return;

    const row = parameters[rowIndex];
    const column = parameters[columnIndex];

    if (!row || !column) return;

    let rowId = row.id;
    let columnId = column.id;
    let storedValue = value;

    if (rowIndex > columnIndex) {
      rowId = column.id;
      columnId = row.id;

      if (value === 1) storedValue = 0;
      else if (value === 0) storedValue = 1;
      else storedValue = 0.5;
    }

    setComparisons((current) => ({
      ...current,
      [comparisonKey(rowId, columnId)]: storedValue,
    }));

    setMessage('');
  }

  function cycleComparison(
    rowIndex: number,
    columnIndex: number
  ) {
    const current = getComparison(rowIndex, columnIndex);

    if (current === null) return;

    let nextValue = 1;

    if (current === 1) nextValue = 0.5;
    else if (current === 0.5) nextValue = 0;
    else nextValue = 1;

    setComparison(rowIndex, columnIndex, nextValue);
  }

  const calculationRows = useMemo(() => {
    const n = parameters.length;

    if (n === 0) return [];

    const rows = parameters.map((parameter, rowIndex) => {
      let points = 0;

      for (
        let columnIndex = 0;
        columnIndex < n;
        columnIndex++
      ) {
        if (rowIndex === columnIndex) continue;

        points +=
          getComparison(rowIndex, columnIndex) ?? 0;
      }

      const score =
        n > 1 ? (points / (n - 1)) * 10 : 10;

      return {
        parameter,
        points,
        score,
      };
    });

    const scores = rows.map((row) => row.score);

    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);

    return rows.map((row) => {
      let weight = 10;

      if (maxScore !== minScore) {
        if (Math.abs(row.score - maxScore) < 0.000001) {
          weight = 10;
        } else {
          weight = Math.round(
            ((row.score - minScore) /
              (maxScore - minScore)) *
              8 +
              1
          );
        }
      }

      weight = Math.max(1, Math.min(10, weight));

      return {
        ...row,
        weight,
      };
    });
  }, [parameters, comparisons]);

  async function saveConfiguration(goNext = false) {
    setSaving(true);
    setError('');
    setMessage('');

    try {
      if (parameters.length < 2) {
        throw new Error(
          'Add at least two parameters before continuing.'
        );
      }

      for (const row of calculationRows) {
        const { error: parameterUpdateError } = await supabase
          .from('parameters')
          .update({
            name: row.parameter.name.trim(),
            unit: row.parameter.unit.trim(),
            indicator_type:
              row.parameter.indicator_type,
            weight: row.weight,
            sort_order: row.parameter.sort_order,
          })
          .eq('id', row.parameter.id)
          .eq('project_id', projectId);

        if (parameterUpdateError) {
          throw parameterUpdateError;
        }
      }

      const comparisonRows: any[] = [];

      for (let rowIndex = 0; rowIndex < parameters.length; rowIndex++) {
        for (
          let columnIndex = rowIndex + 1;
          columnIndex < parameters.length;
          columnIndex++
        ) {
          const row = parameters[rowIndex];
          const column = parameters[columnIndex];

          const value =
            comparisons[
              comparisonKey(row.id, column.id)
            ] ?? 0.5;

          comparisonRows.push({
            project_id: projectId,
            parameter_row_id: row.id,
            parameter_column_id: column.id,
            value,
          });
        }
      }

      const { error: clearError } = await supabase
        .from('parameter_comparisons')
        .delete()
        .eq('project_id', projectId);

      if (clearError) throw clearError;

      if (comparisonRows.length > 0) {
        const { error: comparisonInsertError } =
          await supabase
            .from('parameter_comparisons')
            .insert(comparisonRows);

        if (comparisonInsertError) {
          throw comparisonInsertError;
        }
      }

      setParameters((current) =>
        current.map((parameter) => {
          const calculated = calculationRows.find(
            (row) =>
              row.parameter.id === parameter.id
          );

          return calculated
            ? {
                ...parameter,
                weight: calculated.weight,
              }
            : parameter;
        })
      );

      setMessage('Configuration saved successfully ✅');

      if (goNext) {
        router.push(
          `/project/${projectId}/input-matrix`
        );
      }
    } catch (err: any) {
      console.error('SAVE ERROR:', err);

      setError(
        err?.message ||
          err?.details ||
          err?.hint ||
          'Configuration could not be saved.'
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f8fc]">
        <p className="text-lg font-semibold text-[#60788A]">
          Loading configuration...
        </p>
      </main>
    );
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

            <h1 className="text-xl font-bold">
              Market Product Value
            </h1>
          </div>

          <button
            onClick={() => router.push('/dashboard')}
            className="rounded-xl border border-[#cbdde9] bg-white px-5 py-3 font-semibold text-[#153A5B]"
          >
            My Projects
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-10">
        {/* PROJECT */}
        <p className="text-sm font-bold uppercase tracking-[0.3em] text-[#4EA3E3]">
          {projectName || 'MPV Project'}
        </p>

        <h2 className="mt-2 text-4xl font-bold">
          Product Evaluation
        </h2>

        {/* MODULE NAVIGATION */}
        <div className="mt-8 overflow-x-auto rounded-2xl border border-[#dbe8f2] bg-white p-2">
          <div className="flex min-w-[700px] gap-2">
            <ModuleButton
              number="1"
              label="Configuration"
              active
              onClick={() =>
                router.push(
                  `/project/${projectId}/configuration`
                )
              }
            />

            <ModuleButton
              number="2"
              label="Input Matrix"
              onClick={() =>
                router.push(
                  `/project/${projectId}/input-matrix`
                )
              }
            />

            <ModuleButton
              number="3"
              label="Comparison"
              onClick={() =>
                router.push(
                  `/project/${projectId}/comparison`
                )
              }
            />

            <ModuleButton
              number="4"
              label="Results"
              onClick={() =>
                router.push(
                  `/project/${projectId}/results`
                )
              }
            />
          </div>
        </div>

        {/* TITLE */}
        <section className="mt-8">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-[#4EA3E3]">
            Module 1
          </p>

          <h3 className="mt-3 text-4xl font-bold">
            Parameters & Priority Matrix
          </h3>

          <p className="mt-4 max-w-3xl text-lg leading-8 text-[#60788A]">
            Define the technical parameters and compare their
            importance pair by pair. The final weight
            coefficients are calculated automatically using the
            MPV methodology.
          </p>
        </section>

        {/* ADD PARAMETER */}
        <section className="mt-10 rounded-3xl border border-[#dbe8f2] bg-white p-7 shadow-sm">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#4EA3E3]">
              Parameters
            </p>

            <h4 className="mt-2 text-2xl font-bold">
              Add evaluation parameter
            </h4>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-4">
            <div>
              <label className="mb-2 block text-sm font-bold">
                Parameter name
              </label>

              <input
                value={newName}
                onChange={(e) =>
                  setNewName(e.target.value)
                }
                placeholder="e.g. RAM"
                className="w-full rounded-xl border border-[#cbdde9] px-4 py-3 outline-none focus:border-[#4EA3E3]"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold">
                Unit
              </label>

              <input
                value={newUnit}
                onChange={(e) =>
                  setNewUnit(e.target.value)
                }
                placeholder="e.g. GB"
                className="w-full rounded-xl border border-[#cbdde9] px-4 py-3 outline-none focus:border-[#4EA3E3]"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold">
                Indicator type
              </label>

              <select
                value={newIndicatorType}
                onChange={(e) =>
                  setNewIndicatorType(
                    e.target.value as
                      | 'stimulant'
                      | 'destimulant'
                  )
                }
                className="w-full rounded-xl border border-[#cbdde9] px-4 py-3 outline-none focus:border-[#4EA3E3]"
              >
                <option value="stimulant">
                  Stimulant — More is better
                </option>

                <option value="destimulant">
                  Destimulant — Less is better
                </option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={addParameter}
                disabled={adding}
                className="w-full rounded-xl bg-[#17496D] px-5 py-3 font-bold text-white disabled:opacity-50"
              >
                {adding
                  ? 'Adding...'
                  : '+ Add Parameter'}
              </button>
            </div>
          </div>
        </section>

        {/* PARAMETER LIST */}
        {parameters.length > 0 && (
          <section className="mt-6 rounded-3xl border border-[#dbe8f2] bg-white p-7 shadow-sm">
            <h4 className="text-2xl font-bold">
              Defined Parameters
            </h4>

            <div className="mt-6 space-y-3">
              {parameters.map((parameter, index) => (
                <div
                  key={parameter.id}
                  className="grid gap-3 rounded-2xl border border-[#e2ebf2] bg-[#f8fbfd] p-4 lg:grid-cols-[70px_1fr_180px_250px_100px]"
                >
                  <div className="flex items-center font-bold text-[#4EA3E3]">
                    P{index + 1}
                  </div>

                  <input
                    value={parameter.name}
                    onChange={(e) =>
                      updateParameter(
                        parameter.id,
                        'name',
                        e.target.value
                      )
                    }
                    className="rounded-xl border border-[#cbdde9] bg-white px-4 py-3"
                  />

                  <input
                    value={parameter.unit}
                    onChange={(e) =>
                      updateParameter(
                        parameter.id,
                        'unit',
                        e.target.value
                      )
                    }
                    className="rounded-xl border border-[#cbdde9] bg-white px-4 py-3"
                  />

                  <select
                    value={parameter.indicator_type}
                    onChange={(e) =>
                      updateParameter(
                        parameter.id,
                        'indicator_type',
                        e.target.value
                      )
                    }
                    className="rounded-xl border border-[#cbdde9] bg-white px-4 py-3"
                  >
                    <option value="stimulant">
                      ↑ More is better
                    </option>

                    <option value="destimulant">
                      ↓ Less is better
                    </option>
                  </select>

                  <button
                    onClick={() =>
                      deleteParameter(parameter.id)
                    }
                    className="rounded-xl border border-red-200 bg-white px-3 py-3 font-semibold text-red-600"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* PRIORITY MATRIX */}
        {parameters.length >= 2 && (
          <section className="mt-6 rounded-3xl border border-[#dbe8f2] bg-white p-7 shadow-sm">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#4EA3E3]">
                Pairwise comparison
              </p>

              <h4 className="mt-2 text-2xl font-bold">
                Parameter Priority Matrix
              </h4>

              <p className="mt-3 max-w-4xl leading-7 text-[#60788A]">
                Compare the parameter in the row with the
                parameter in the column. Use
                <strong> 1 </strong>
                when the row parameter is more important,
                <strong> 0.5 </strong>
                when both are equally important and
                <strong> 0 </strong>
                when the row parameter is less important.
                The opposite cell is calculated automatically.
              </p>

              <p className="mt-2 text-sm font-semibold text-[#4EA3E3]">
                Click a cell to cycle: 1 → 0.5 → 0 → 1
              </p>
            </div>

            <div className="mt-7 overflow-x-auto">
              <table className="min-w-max border-collapse">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-20 min-w-[220px] border border-[#dbe8f2] bg-[#153A5B] p-3 text-left text-sm text-white">
                      Parameters
                    </th>

                    {parameters.map(
                      (parameter, index) => (
                        <th
                          key={parameter.id}
                          className="min-w-[150px] border border-[#dbe8f2] bg-[#153A5B] p-3 text-center text-sm text-white"
                        >
                          <div>P{index + 1}</div>

                          <div className="mt-1 text-xs font-normal text-[#cfe4f2]">
                            {parameter.name}
                          </div>
                        </th>
                      )
                    )}
                  </tr>
                </thead>

                <tbody>
                  {parameters.map(
                    (rowParameter, rowIndex) => (
                      <tr key={rowParameter.id}>
                        <th className="sticky left-0 z-10 border border-[#dbe8f2] bg-[#eef6fb] p-3 text-left">
                          <div className="text-sm font-bold">
                            P{rowIndex + 1}
                          </div>

                          <div className="mt-1 text-xs text-[#60788A]">
                            {rowParameter.name}
                          </div>
                        </th>

                        {parameters.map(
                          (
                            columnParameter,
                            columnIndex
                          ) => {
                            const value =
                              getComparison(
                                rowIndex,
                                columnIndex
                              );

                            const diagonal =
                              rowIndex ===
                              columnIndex;

                            const editable =
                              rowIndex <
                              columnIndex;

                            return (
                              <td
                                key={
                                  columnParameter.id
                                }
                                className={`border border-[#dbe8f2] p-2 text-center ${
                                  diagonal
                                    ? 'bg-[#d6dde2]'
                                    : editable
                                    ? 'bg-white'
                                    : 'bg-[#f4f8fc]'
                                }`}
                              >
                                {diagonal ? (
                                  <div className="h-11" />
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (editable) {
                                        cycleComparison(
                                          rowIndex,
                                          columnIndex
                                        );
                                      }
                                    }}
                                    className={`h-11 w-full rounded-lg text-base font-bold ${
                                      editable
                                        ? value === 1
                                          ? 'bg-[#17496D] text-white'
                                          : value ===
                                            0.5
                                          ? 'bg-[#dff1fc] text-[#153A5B]'
                                          : 'bg-[#f3f5f7] text-[#60788A]'
                                        : 'cursor-default bg-transparent text-[#60788A]'
                                    }`}
                                  >
                                    {value}
                                  </button>
                                )}
                              </td>
                            );
                          }
                        )}
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* AUTOMATIC WEIGHTS */}
        {parameters.length >= 2 && (
          <section className="mt-6 rounded-3xl border border-[#dbe8f2] bg-white p-7 shadow-sm">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#4EA3E3]">
                Automatic calculation
              </p>

              <h4 className="mt-2 text-2xl font-bold">
                Weight Coefficients
              </h4>

              <p className="mt-3 text-[#60788A]">
                Calculated automatically from the priority
                matrix using the same method as the MPV Excel
                model.
              </p>
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[750px] border-collapse">
                <thead>
                  <tr className="bg-[#153A5B] text-white">
                    <th className="p-4 text-left">
                      Parameter
                    </th>

                    <th className="p-4 text-center">
                      Sum of points
                    </th>

                    <th className="p-4 text-center">
                      Score
                    </th>

                    <th className="p-4 text-center">
                      Weight coefficient
                    </th>

                    <th className="p-4 text-left">
                      Indicator
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {calculationRows.map(
                    (row, index) => (
                      <tr
                        key={row.parameter.id}
                        className="border-b border-[#dbe8f2]"
                      >
                        <td className="p-4">
                          <div className="font-bold">
                            P{index + 1} —{' '}
                            {row.parameter.name}
                          </div>

                          <div className="mt-1 text-sm text-[#60788A]">
                            {row.parameter.unit}
                          </div>
                        </td>

                        <td className="p-4 text-center text-lg font-semibold">
                          {formatNumber(
                            row.points
                          )}
                        </td>

                        <td className="p-4 text-center text-lg font-semibold">
                          {row.score.toFixed(2)}
                        </td>

                        <td className="p-4 text-center">
                          <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#17496D] text-lg font-bold text-white">
                            {row.weight}
                          </span>
                        </td>

                        <td className="p-4">
                          {row.parameter
                            .indicator_type ===
                          'stimulant'
                            ? '↑ Stimulant — More is better'
                            : '↓ Destimulant — Less is better'}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-5 rounded-2xl bg-[#eef7fd] p-5 text-sm leading-6 text-[#60788A]">
              <strong className="text-[#153A5B]">
                Excel logic:
              </strong>{' '}
              each parameter receives pairwise comparison
              points. The points are converted into a 0–10
              score and then into a final weight coefficient
              from 1 to 10.
            </div>
          </section>
        )}

        {/* MESSAGES */}
        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
            {error}
          </div>
        )}

        {message && (
          <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-5 text-green-700">
            {message}
          </div>
        )}

        {/* ACTIONS */}
        <section className="mt-8 border-t border-[#dbe8f2] pt-8">
          <button
            onClick={() =>
              router.push('/dashboard')
            }
            className="w-full rounded-xl border border-[#cbdde9] bg-white px-6 py-4 font-bold text-[#153A5B]"
          >
            ← Back to Projects
          </button>

          <button
            onClick={() =>
              saveConfiguration(false)
            }
            disabled={
              saving || parameters.length < 2
            }
            className="mt-3 w-full rounded-xl bg-[#17496D] px-6 py-4 font-bold text-white disabled:opacity-50"
          >
            {saving
              ? 'Saving...'
              : 'Save Configuration'}
          </button>

          <button
            onClick={() =>
              saveConfiguration(true)
            }
            disabled={
              saving || parameters.length < 2
            }
            className="mt-3 w-full rounded-xl bg-[#4EA3E3] px-6 py-4 font-bold text-white disabled:opacity-50"
          >
            {saving
              ? 'Saving...'
              : 'Save & Continue to Input Matrix →'}
          </button>
        </section>
      </div>
    </main>
  );
}

function ModuleButton({
  number,
  label,
  active = false,
  onClick,
}: {
  number: string;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-3 rounded-xl px-5 py-4 font-bold ${
        active
          ? 'bg-[#17496D] text-white'
          : 'bg-white text-[#60788A] hover:bg-[#f4f8fc]'
      }`}
    >
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm ${
          active
            ? 'bg-white/15'
            : 'bg-[#eef6fb] text-[#4EA3E3]'
        }`}
      >
        {number}
      </span>

      {label}
    </button>
  );
}

function formatNumber(value: number) {
  if (Number.isInteger(value)) {
    return value.toString();
  }

  return value.toFixed(1);
}