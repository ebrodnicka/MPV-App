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

type Product = {
  id: string;
  name: string;
  price: number | null;
  sort_order: number;
};

type RawValueMap = Record<string, number>;

type ParameterStatistic = {
  parameterId: string;
  max: number | null;
  min: number | null;
};

export default function ComparisonPage() {
  const params = useParams();
  const router = useRouter();

  const projectId = params.id as string;

  const [projectName, setProjectName] = useState('');
  const [parameters, setParameters] = useState<Parameter[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [rawValues, setRawValues] = useState<RawValueMap>({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadPage();
  }, [projectId]);

  function valueKey(productId: string, parameterId: string) {
    return `${productId}__${parameterId}`;
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

      const { data: parameterRows, error: parameterError } =
        await supabase
          .from('parameters')
          .select(
            'id, name, unit, indicator_type, weight, sort_order'
          )
          .eq('project_id', projectId)
          .order('sort_order', { ascending: true });

      if (parameterError) throw parameterError;

      const loadedParameters: Parameter[] = (
        parameterRows ?? []
      ).map((row: any, index: number) => ({
        id: row.id,
        name: row.name ?? '',
        unit: row.unit ?? '',
        indicator_type:
          row.indicator_type === 'destimulant'
            ? 'destimulant'
            : 'stimulant',
        weight: Number(row.weight ?? 1),
        sort_order: Number(row.sort_order ?? index),
      }));

      setParameters(loadedParameters);

      const { data: productRows, error: productError } =
        await supabase
          .from('products')
          .select('id, name, price, sort_order')
          .eq('project_id', projectId)
          .order('sort_order', { ascending: true });

      if (productError) throw productError;

      const loadedProducts: Product[] = (productRows ?? []).map(
        (row: any, index: number) => ({
          id: row.id,
          name: row.name ?? '',
          price:
            row.price === null || row.price === undefined
              ? null
              : Number(row.price),
          sort_order: Number(row.sort_order ?? index),
        })
      );

      setProducts(loadedProducts);

      if (loadedProducts.length > 0) {
        const productIds = loadedProducts.map(
          (product) => product.id
        );

        const { data: valueRows, error: valueError } =
          await supabase
            .from('product_parameter_values')
            .select(
              'product_id, parameter_id, raw_value'
            )
            .in('product_id', productIds);

        if (valueError) throw valueError;

        const loadedValues: RawValueMap = {};

        (valueRows ?? []).forEach((row: any) => {
          loadedValues[
            valueKey(row.product_id, row.parameter_id)
          ] = Number(row.raw_value);
        });

        setRawValues(loadedValues);
      }
    } catch (err: any) {
      console.error(err);

      setError(
        err?.message ||
          'MPV Points could not be loaded.'
      );
    } finally {
      setLoading(false);
    }
  }

  const statistics: ParameterStatistic[] = useMemo(() => {
    return parameters.map((parameter) => {
      const values = products
        .map((product) => {
          const value =
            rawValues[
              valueKey(product.id, parameter.id)
            ];

          return Number.isFinite(value)
            ? value
            : null;
        })
        .filter(
          (value): value is number =>
            value !== null
        );

      return {
        parameterId: parameter.id,
        max:
          values.length > 0
            ? Math.max(...values)
            : null,
        min:
          values.length > 0
            ? Math.min(...values)
            : null,
      };
    });
  }, [parameters, products, rawValues]);

  function getStatistic(
    parameterId: string,
    type: 'max' | 'min'
  ) {
    const statistic = statistics.find(
      (item) =>
        item.parameterId === parameterId
    );

    return statistic
      ? statistic[type]
      : null;
  }

  function calculatePoints(
    productId: string,
    parameter: Parameter
  ): number | null {
    const raw =
      rawValues[
        valueKey(productId, parameter.id)
      ];

    if (!Number.isFinite(raw)) {
      return null;
    }

    const max = getStatistic(
      parameter.id,
      'max'
    );

    const min = getStatistic(
      parameter.id,
      'min'
    );

    // STIMULANT:
    // Raw / MAX × 10
    if (
      parameter.indicator_type ===
      'stimulant'
    ) {
      if (
        max === null ||
        max === 0
      ) {
        return null;
      }

      return (raw / max) * 10;
    }

    // DESTIMULANT:
    // MIN / Raw × 10
    if (
      min === null ||
      raw === 0
    ) {
      return null;
    }

    return (min / raw) * 10;
  }

  const productResults = useMemo(() => {
    return products.map((product) => {
      const points = parameters.map(
        (parameter) => ({
          parameter,
          raw:
            rawValues[
              valueKey(
                product.id,
                parameter.id
              )
            ],
          points: calculatePoints(
            product.id,
            parameter
          ),
        })
      );

      return {
        product,
        points,
      };
    });
  }, [
    products,
    parameters,
    rawValues,
    statistics,
  ]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f8fc]">
        <p className="text-lg font-semibold text-[#60788A]">
          Calculating MPV Points...
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
            onClick={() =>
              router.push('/dashboard')
            }
            className="rounded-xl border border-[#cbdde9] bg-white px-5 py-3 font-semibold"
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
          <div className="flex min-w-[900px] gap-2">
            <ModuleButton
              number="1"
              label="Configuration"
              onClick={() =>
                router.push(
                  `/project/${projectId}/configuration`
                )
              }
            />

            <ModuleButton
              number="2"
              label="Raw Data"
              onClick={() =>
                router.push(
                  `/project/${projectId}/input-matrix`
                )
              }
            />

            <ModuleButton
              number="3"
              label="MPV Points"
              active
              onClick={() =>
                router.push(
                  `/project/${projectId}/comparison`
                )
              }
            />

            <ModuleButton
              number="4"
              label="Customer Value"
              onClick={() =>
                router.push(
                  `/project/${projectId}/customer-value`
                )
              }
            />

            <ModuleButton
              number="5"
              label="GPP"
              disabled
              onClick={() => {}}
            />

            <ModuleButton
              number="6"
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
            Module 3
          </p>

          <h3 className="mt-3 text-4xl font-bold">
            Points of MPV
          </h3>

          <p className="mt-4 max-w-4xl text-lg leading-8 text-[#60788A]">
            Raw technical values are automatically
            converted into a normalized 1–10 MPV
            point scale using the stimulant and
            destimulant logic defined in
            Configuration.
          </p>
        </section>

        {/* FORMULAS */}
        <section className="mt-8 grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-[#dbe8f2] bg-white p-6 shadow-sm">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#4EA3E3]">
              Stimulant
            </p>

            <h4 className="mt-2 text-xl font-bold">
              More is better ↑
            </h4>

            <div className="mt-4 rounded-2xl bg-[#eef7fd] p-5 text-center text-lg font-bold">
              Points = Raw Value / MAX × 10
            </div>

            <p className="mt-4 text-sm leading-6 text-[#60788A]">
              The product with the highest raw value
              receives 10 points.
            </p>
          </div>

          <div className="rounded-3xl border border-[#dbe8f2] bg-white p-6 shadow-sm">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#4EA3E3]">
              Destimulant
            </p>

            <h4 className="mt-2 text-xl font-bold">
              Less is better ↓
            </h4>

            <div className="mt-4 rounded-2xl bg-[#eef7fd] p-5 text-center text-lg font-bold">
              Points = MIN / Raw Value × 10
            </div>

            <p className="mt-4 text-sm leading-6 text-[#60788A]">
              The product with the lowest raw value
              receives 10 points.
            </p>
          </div>
        </section>

        {/* TABLE */}
        {products.length > 0 &&
          parameters.length > 0 && (
            <section className="mt-6 rounded-3xl border border-[#dbe8f2] bg-white p-7 shadow-sm">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#4EA3E3]">
                  Automated calculation
                </p>

                <h4 className="mt-2 text-2xl font-bold">
                  Normalized MPV Point Matrix
                </h4>

                <p className="mt-3 text-[#60788A]">
                  This table corresponds to the Excel
                  sheet “POINTS OF MPV (Scale 1–10)”.
                </p>
              </div>

              <div className="mt-7 overflow-x-auto">
                <table className="min-w-max border-collapse">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-20 min-w-[240px] border border-[#dbe8f2] bg-[#153A5B] p-3 text-left text-white">
                        Brand / Parameters
                      </th>

                      {parameters.map(
                        (parameter) => (
                          <th
                            key={parameter.id}
                            className="min-w-[180px] border border-[#dbe8f2] bg-[#153A5B] p-3 text-center text-white"
                          >
                            <div>
                              {parameter.name}
                            </div>

                            <div className="mt-1 text-xs font-normal text-[#cfe4f2]">
                              {parameter.unit}
                            </div>

                            <div className="mt-2 text-xs font-semibold text-[#6bc1ff]">
                              {parameter.indicator_type ===
                              'stimulant'
                                ? '↑ Stimulant'
                                : '↓ Destimulant'}
                            </div>

                            <div className="mt-1 text-xs font-normal">
                              Weight{' '}
                              {parameter.weight}
                              /10
                            </div>
                          </th>
                        )
                      )}
                    </tr>
                  </thead>

                  <tbody>
                    {productResults.map(
                      ({
                        product,
                        points,
                      }) => (
                        <tr key={product.id}>
                          <th className="sticky left-0 z-10 border border-[#dbe8f2] bg-[#eef6fb] p-3 text-left">
                            {product.name}
                          </th>

                          {points.map(
                            (item) => (
                              <td
                                key={
                                  item
                                    .parameter
                                    .id
                                }
                                className="border border-[#dbe8f2] bg-[#f7fbf4] p-3 text-center"
                              >
                                <span className="text-lg font-bold text-[#153A5B]">
                                  {formatPoints(
                                    item.points
                                  )}
                                </span>
                              </td>
                            )
                          )}
                        </tr>
                      )
                    )}

                    {/* MAX */}
                    <tr className="bg-[#eef5df] font-bold">
                      <td className="sticky left-0 z-10 border border-[#dbe8f2] bg-[#eef5df] p-3">
                        MAX
                      </td>

                      {parameters.map(
                        (parameter) => (
                          <td
                            key={parameter.id}
                            className="border border-[#dbe8f2] p-3 text-center"
                          >
                            {formatRaw(
                              getStatistic(
                                parameter.id,
                                'max'
                              )
                            )}
                          </td>
                        )
                      )}
                    </tr>

                    {/* MIN */}
                    <tr className="bg-[#eef5df] font-bold">
                      <td className="sticky left-0 z-10 border border-[#dbe8f2] bg-[#eef5df] p-3">
                        MIN
                      </td>

                      {parameters.map(
                        (parameter) => (
                          <td
                            key={parameter.id}
                            className="border border-[#dbe8f2] p-3 text-center"
                          >
                            {formatRaw(
                              getStatistic(
                                parameter.id,
                                'min'
                              )
                            )}
                          </td>
                        )
                      )}
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          )}

        {/* PARAMETER CARDS */}
        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          {parameters.map(
            (parameter, index) => (
              <div
                key={parameter.id}
                className="rounded-2xl border border-[#dbe8f2] bg-white p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-[#4EA3E3]">
                      P{index + 1}
                    </p>

                    <h5 className="mt-1 font-bold">
                      {parameter.name}
                    </h5>

                    <p className="mt-1 text-sm text-[#60788A]">
                      {parameter.unit ||
                        'No unit'}
                    </p>
                  </div>

                  <div className="rounded-xl bg-[#17496D] px-4 py-2 font-bold text-white">
                    Weight{' '}
                    {parameter.weight}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-xl bg-[#f4f8fc] p-3">
                    <p className="text-xs text-[#60788A]">
                      MAX
                    </p>

                    <p className="mt-1 font-bold">
                      {formatRaw(
                        getStatistic(
                          parameter.id,
                          'max'
                        )
                      )}
                    </p>
                  </div>

                  <div className="rounded-xl bg-[#f4f8fc] p-3">
                    <p className="text-xs text-[#60788A]">
                      MIN
                    </p>

                    <p className="mt-1 font-bold">
                      {formatRaw(
                        getStatistic(
                          parameter.id,
                          'min'
                        )
                      )}
                    </p>
                  </div>

                  <div className="rounded-xl bg-[#f4f8fc] p-3">
                    <p className="text-xs text-[#60788A]">
                      TYPE
                    </p>

                    <p className="mt-1 font-bold">
                      {parameter.indicator_type ===
                      'stimulant'
                        ? '↑'
                        : '↓'}
                    </p>
                  </div>
                </div>
              </div>
            )
          )}
        </section>

        {/* ERROR */}
        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
            {error}
          </div>
        )}

        {/* ACTIONS */}
        <section className="mt-8 border-t border-[#dbe8f2] pt-8">
          <button
            onClick={() =>
              router.push(
                `/project/${projectId}/input-matrix`
              )
            }
            className="w-full rounded-xl border border-[#cbdde9] bg-white px-6 py-4 font-bold"
          >
            ← Back to Raw Data
          </button>

          <button
            onClick={() =>
              router.push(
                `/project/${projectId}/customer-value`
              )
            }
            disabled={
              products.length === 0 ||
              parameters.length === 0
            }
            className="mt-3 w-full rounded-xl bg-[#4EA3E3] px-6 py-4 font-bold text-white disabled:opacity-50"
          >
            Continue to Customer Value →
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
  disabled = false,
  onClick,
}: {
  number: string;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-4 text-sm font-bold ${
        active
          ? 'bg-[#17496D] text-white'
          : disabled
          ? 'cursor-not-allowed bg-[#f4f8fc] text-[#a3b3bf]'
          : 'bg-white text-[#60788A] hover:bg-[#f4f8fc]'
      }`}
    >
      <span
        className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs ${
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

function formatPoints(
  value: number | null
) {
  if (
    value === null ||
    !Number.isFinite(value)
  ) {
    return '—';
  }

  return value.toFixed(2);
}

function formatRaw(
  value: number | null
) {
  if (
    value === null ||
    !Number.isFinite(value)
  ) {
    return '—';
  }

  if (Number.isInteger(value)) {
    return value.toString();
  }

  return Number(
    value.toFixed(4)
  ).toString();
}