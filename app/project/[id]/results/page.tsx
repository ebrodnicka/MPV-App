'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';

type Parameter = {
  id: string;
  name: string;
  unit: string | null;
  indicator_type: 'stimulant' | 'destimulant';
  weight: number;
  sort_order: number | null;
};

type Product = {
  id: string;
  name: string;
  sort_order: number | null;
};

type RawValue = {
  product_id: string;
  parameter_id: string;
  raw_value: number;
};

type ScoreRow = {
  productId: string;
  productName: string;
  parameterScores: Record<string, number>;
  totalScore: number;
};

export default function ResultsPage() {
  const params = useParams();
  const router = useRouter();

  const projectId = params.id as string;

  const [projectName, setProjectName] = useState('');
  const [projectCategory, setProjectCategory] = useState('');

  const [parameters, setParameters] = useState<Parameter[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [rawValues, setRawValues] = useState<RawValue[]>([]);

  const [loading, setLoading] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState('');

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
        name: parameter.name,
        unit: parameter.unit,
        indicator_type:
          parameter.indicator_type === 'destimulant'
            ? 'destimulant'
            : 'stimulant',
        weight: Number(parameter.weight || 0),
        sort_order: parameter.sort_order,
      })
    );

    setParameters(loadedParameters);

    const { data: productData, error: productError } = await supabase
      .from('products')
      .select('id, name, sort_order')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true });

    if (productError) {
      setError(productError.message);
      setLoading(false);
      return;
    }

    const loadedProducts: Product[] = productData || [];

    setProducts(loadedProducts);

    if (loadedProducts.length === 0) {
      setRawValues([]);
      setLoading(false);
      return;
    }

    const productIds = loadedProducts.map((product) => product.id);

    const { data: valueData, error: valueError } = await supabase
      .from('product_parameter_values')
      .select('product_id, parameter_id, raw_value')
      .in('product_id', productIds);

    if (valueError) {
      setError(valueError.message);
      setLoading(false);
      return;
    }

    setRawValues(
      (valueData || []).map((row) => ({
        product_id: row.product_id,
        parameter_id: row.parameter_id,
        raw_value: Number(row.raw_value),
      }))
    );

    setLoading(false);
  }

  function getRawValue(productId: string, parameterId: string) {
    return rawValues.find(
      (row) =>
        row.product_id === productId &&
        row.parameter_id === parameterId
    )?.raw_value;
  }

  const scoreRows = useMemo<ScoreRow[]>(() => {
    if (
      parameters.length === 0 ||
      products.length === 0 ||
      rawValues.length === 0
    ) {
      return [];
    }

    const totalWeight = parameters.reduce(
      (sum, parameter) => sum + parameter.weight,
      0
    );

    if (totalWeight === 0) {
      return [];
    }

    return products
      .map((product) => {
        const parameterScores: Record<string, number> = {};

        let totalScore = 0;

        parameters.forEach((parameter) => {
          const parameterValues = products
            .map((currentProduct) =>
              getRawValue(currentProduct.id, parameter.id)
            )
            .filter(
              (value): value is number =>
                value !== undefined && Number.isFinite(value)
            );

          const currentValue = getRawValue(product.id, parameter.id);

          if (
            currentValue === undefined ||
            parameterValues.length === 0
          ) {
            parameterScores[parameter.id] = 0;
            return;
          }

          const min = Math.min(...parameterValues);
          const max = Math.max(...parameterValues);

          let normalized = 1;

          if (max !== min) {
            if (parameter.indicator_type === 'destimulant') {
              normalized = (max - currentValue) / (max - min);
            } else {
              normalized = (currentValue - min) / (max - min);
            }
          }

          normalized = Math.max(0, Math.min(1, normalized));

          const weightShare = parameter.weight / totalWeight;
          const weightedScore = normalized * weightShare * 100;

          parameterScores[parameter.id] = weightedScore;
          totalScore += weightedScore;
        });

        return {
          productId: product.id,
          productName: product.name,
          parameterScores,
          totalScore,
        };
      })
      .sort((a, b) => b.totalScore - a.totalScore);
  }, [parameters, products, rawValues]);

  const winner = scoreRows.length > 0 ? scoreRows[0] : null;

  const secondPlace =
    scoreRows.length > 1 ? scoreRows[1] : null;

  const scoreGap =
    winner && secondPlace
      ? winner.totalScore - secondPlace.totalScore
      : null;

  const isTie =
    winner &&
    secondPlace &&
    Math.abs(winner.totalScore - secondPlace.totalScore) < 0.01;

  async function finishAnalysis() {
    setFinishing(true);
    setError('');

    try {
      const { error: updateError } = await supabase
        .from('projects')
        .update({
          current_step: 'Results',
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId);

      if (updateError) {
        throw updateError;
      }

      router.push('/dashboard');
    } catch (finishError: any) {
      setError(
        finishError?.message ||
          finishError?.details ||
          'Analysis could not be completed.'
      );
    } finally {
      setFinishing(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f8fc]">
        <p className="text-[#60788A]">Preparing final results...</p>
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

      <section className="mx-auto max-w-7xl px-6 py-10">
        <p className="text-sm font-bold uppercase tracking-[0.3em] text-[#4EA3E3]">
          {projectCategory || 'MPV Analysis'}
        </p>

        <h2 className="mt-3 text-4xl font-bold text-[#153A5B]">
          {projectName}
        </h2>

        <div className="mt-8 overflow-x-auto rounded-2xl bg-white p-2 shadow-sm">
          <div className="flex min-w-[760px] gap-2">
            <button
              onClick={() =>
                router.push(`/project/${projectId}/configuration`)
              }
              className="flex-1 rounded-xl px-5 py-4 text-center font-semibold text-[#60788A] hover:bg-[#f4f8fc]"
            >
              1 &nbsp; Configuration
            </button>

            <button
              onClick={() =>
                router.push(`/project/${projectId}/input-matrix`)
              }
              className="flex-1 rounded-xl px-5 py-4 text-center font-semibold text-[#60788A] hover:bg-[#f4f8fc]"
            >
              2 &nbsp; Input Matrix
            </button>

            <button
              onClick={() =>
                router.push(`/project/${projectId}/comparison`)
              }
              className="flex-1 rounded-xl px-5 py-4 text-center font-semibold text-[#60788A] hover:bg-[#f4f8fc]"
            >
              3 &nbsp; Comparison
            </button>

            <button
              className="flex-1 rounded-xl bg-[#17496D] px-5 py-4 text-center font-bold text-white"
            >
              4 &nbsp; Results
            </button>
          </div>
        </div>

        <div className="mt-10">
          <p className="text-sm font-bold tracking-[0.3em] text-[#4EA3E3]">
            MODULE 4
          </p>

          <h3 className="mt-3 text-3xl font-bold text-[#153A5B]">
            Final Results
          </h3>

          <p className="mt-3 max-w-3xl text-[#60788A]">
            Review the final product ranking based on normalized parameter
            values and the weights defined in the analysis.
          </p>
        </div>

        {error && (
          <div className="mt-7 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {!error && !winner && (
          <div className="mt-8 rounded-3xl border border-[#dbe8f2] bg-white p-8 text-center">
            <p className="text-lg font-bold text-[#153A5B]">
              Results are not available yet.
            </p>

            <p className="mt-2 text-[#60788A]">
              Complete Configuration and Input Matrix first.
            </p>
          </div>
        )}

        {winner && (
          <>
            <div className="mt-8 rounded-3xl bg-[#17496D] p-8 text-white shadow-sm">
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#9DD4FA]">
                Top Result
              </p>

              <div className="mt-4 flex flex-col justify-between gap-6 md:flex-row md:items-end">
                <div>
                  <p className="text-sm text-[#c8e3f5]">
                    Recommended product
                  </p>

                  <h4 className="mt-2 text-4xl font-bold">
                    {winner.productName}
                  </h4>
                </div>

                <div className="md:text-right">
                  <p className="text-sm text-[#c8e3f5]">
                    MPV Score
                  </p>

                  <p className="mt-1 text-5xl font-bold">
                    {winner.totalScore.toFixed(1)}
                  </p>

                  <p className="text-sm text-[#c8e3f5]">
                    out of 100
                  </p>
                </div>
              </div>

              <div className="mt-7 h-4 overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-white"
                  style={{
                    width: `${Math.max(
                      0,
                      Math.min(100, winner.totalScore)
                    )}%`,
                  }}
                />
              </div>
            </div>

            {isTie && (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-800">
                The two highest-ranked products achieved the same MPV score.
                Review individual parameters before making the final decision.
              </div>
            )}

            {!isTie && scoreGap !== null && (
              <div className="mt-5 rounded-2xl border border-[#dbe8f2] bg-white p-5">
                <p className="text-sm text-[#60788A]">
                  Advantage over second place
                </p>

                <p className="mt-2 text-3xl font-bold text-[#153A5B]">
                  {scoreGap.toFixed(1)} pts
                </p>
              </div>
            )}

            <div className="mt-10">
              <h4 className="text-2xl font-bold text-[#153A5B]">
                Final Ranking
              </h4>

              <div className="mt-5 space-y-4">
                {scoreRows.map((row, index) => (
                  <div
                    key={row.productId}
                    className="rounded-2xl border border-[#dbe8f2] bg-white p-6 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#eef7fd] font-bold text-[#4EA3E3]">
                          #{index + 1}
                        </div>

                        <div>
                          <p className="font-bold text-[#153A5B]">
                            {row.productName}
                          </p>

                          <p className="mt-1 text-sm text-[#60788A]">
                            {index === 0
                              ? 'Highest MPV score'
                              : 'Alternative option'}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-3xl font-bold text-[#153A5B]">
                          {row.totalScore.toFixed(1)}
                        </p>

                        <p className="text-xs text-[#60788A]">
                          / 100
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#e8f0f6]">
                      <div
                        className="h-full rounded-full bg-[#4EA3E3]"
                        style={{
                          width: `${Math.max(
                            0,
                            Math.min(100, row.totalScore)
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-10">
              <h4 className="text-2xl font-bold text-[#153A5B]">
                Winning Product Breakdown
              </h4>

              <p className="mt-2 text-[#60788A]">
                Contribution of each parameter to the final score for{' '}
                <strong>{winner.productName}</strong>.
              </p>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {parameters.map((parameter) => {
                  const rawValue = getRawValue(
                    winner.productId,
                    parameter.id
                  );

                  const contribution =
                    winner.parameterScores[parameter.id] || 0;

                  return (
                    <div
                      key={parameter.id}
                      className="rounded-2xl border border-[#dbe8f2] bg-white p-5"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-bold text-[#153A5B]">
                            {parameter.name}
                          </p>

                          <p className="mt-1 text-xs text-[#60788A]">
                            {parameter.indicator_type === 'destimulant'
                              ? '↓ Less is better'
                              : '↑ More is better'}
                          </p>
                        </div>

                        <span className="rounded-lg bg-[#eef7fd] px-3 py-2 text-sm font-bold text-[#4EA3E3]">
                          Weight {parameter.weight}/10
                        </span>
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-[#60788A]">
                            Raw value
                          </p>

                          <p className="mt-1 text-xl font-bold text-[#153A5B]">
                            {rawValue ?? '—'}{' '}
                            <span className="text-sm font-normal">
                              {parameter.unit || ''}
                            </span>
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-[#60788A]">
                            Contribution
                          </p>

                          <p className="mt-1 text-xl font-bold text-[#4EA3E3]">
                            {contribution.toFixed(1)} pts
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-10 overflow-x-auto rounded-3xl border border-[#dbe8f2] bg-white shadow-sm">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="border-b border-[#dbe8f2] bg-[#f8fbfd]">
                    <th className="px-5 py-4 text-left text-sm font-bold text-[#153A5B]">
                      Rank
                    </th>

                    <th className="px-5 py-4 text-left text-sm font-bold text-[#153A5B]">
                      Product
                    </th>

                    {parameters.map((parameter) => (
                      <th
                        key={parameter.id}
                        className="min-w-[150px] px-5 py-4 text-left"
                      >
                        <p className="text-sm font-bold text-[#153A5B]">
                          {parameter.name}
                        </p>

                        <p className="mt-1 text-xs text-[#60788A]">
                          {parameter.unit || ''}
                        </p>
                      </th>
                    ))}

                    <th className="px-5 py-4 text-left text-sm font-bold text-[#153A5B]">
                      MPV Score
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {scoreRows.map((row, index) => (
                    <tr
                      key={row.productId}
                      className="border-b border-[#edf3f7] last:border-b-0"
                    >
                      <td className="px-5 py-4 font-bold text-[#4EA3E3]">
                        #{index + 1}
                      </td>

                      <td className="px-5 py-4 font-semibold text-[#153A5B]">
                        {row.productName}
                      </td>

                      {parameters.map((parameter) => (
                        <td
                          key={parameter.id}
                          className="px-5 py-4 text-[#153A5B]"
                        >
                          {getRawValue(row.productId, parameter.id) ??
                            '—'}
                        </td>
                      ))}

                      <td className="px-5 py-4 font-bold text-[#153A5B]">
                        {row.totalScore.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="mt-10 border-t border-[#dbe8f2] pt-7">
          <button
            onClick={() =>
              router.push(`/project/${projectId}/comparison`)
            }
            className="w-full rounded-xl border border-[#cbdde9] px-6 py-4 font-semibold text-[#153A5B]"
          >
            ← Back to Comparison
          </button>

          <button
            onClick={() =>
              router.push(`/project/${projectId}/configuration`)
            }
            className="mt-3 w-full rounded-xl border border-[#cbdde9] px-6 py-4 font-semibold text-[#153A5B]"
          >
            Edit Configuration
          </button>

          <button
            onClick={() =>
              router.push(`/project/${projectId}/input-matrix`)
            }
            className="mt-3 w-full rounded-xl border border-[#cbdde9] px-6 py-4 font-semibold text-[#153A5B]"
          >
            Edit Input Matrix
          </button>

          <button
            onClick={finishAnalysis}
            disabled={finishing || !winner}
            className="mt-3 w-full rounded-xl bg-[#17496D] px-6 py-4 font-bold text-white disabled:opacity-50"
          >
            {finishing
              ? 'Finishing...'
              : 'Finish Analysis & Return to My Projects ✓'}
          </button>
        </div>
      </section>
    </main>
  );
}