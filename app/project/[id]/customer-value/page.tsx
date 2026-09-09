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
  price: number;
  sort_order: number;
};

type RawValueMap = Record<string, number>;

export default function CustomerValuePage() {
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
          price: Number(row.price ?? 0),
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
            .select('product_id, parameter_id, raw_value')
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
          'Customer Value could not be loaded.'
      );
    } finally {
      setLoading(false);
    }
  }

  const statistics = useMemo(() => {
    return parameters.map((parameter) => {
      const numbers = products
        .map((product) => {
          const raw =
            rawValues[
              valueKey(product.id, parameter.id)
            ];

          return Number.isFinite(raw) ? raw : null;
        })
        .filter(
          (value): value is number =>
            value !== null
        );

      return {
        parameterId: parameter.id,
        max:
          numbers.length > 0
            ? Math.max(...numbers)
            : null,
        min:
          numbers.length > 0
            ? Math.min(...numbers)
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

  function getMPVPoints(
    productId: string,
    parameter: Parameter
  ): number {
    const raw =
      rawValues[
        valueKey(productId, parameter.id)
      ];

    if (!Number.isFinite(raw)) {
      return 0;
    }

    const max = getStatistic(
      parameter.id,
      'max'
    );

    const min = getStatistic(
      parameter.id,
      'min'
    );

    if (
      parameter.indicator_type ===
      'stimulant'
    ) {
      if (
        max === null ||
        max === 0
      ) {
        return 0;
      }

      return (raw / max) * 10;
    }

    if (
      min === null ||
      raw === 0
    ) {
      return 0;
    }

    return (min / raw) * 10;
  }

  const performanceRows = useMemo(() => {
    return products.map((product) => {
      let weightedSum = 0;

      parameters.forEach((parameter) => {
        const points =
          getMPVPoints(
            product.id,
            parameter
          );

        weightedSum +=
          points * parameter.weight;
      });

      const performance =
        weightedSum / 10;

      return {
        product,
        performance,
      };
    });
  }, [
    products,
    parameters,
    rawValues,
    statistics,
  ]);

  const averagePerformance = useMemo(() => {
    const valid = performanceRows
      .map((row) => row.performance)
      .filter(
        (value) =>
          Number.isFinite(value) &&
          value > 0
      );

    if (valid.length === 0) return 0;

    return (
      valid.reduce(
        (sum, value) =>
          sum + value,
        0
      ) / valid.length
    );
  }, [performanceRows]);

  const averagePrice = useMemo(() => {
    const validPrices = products
      .map((product) => product.price)
      .filter(
        (price) =>
          Number.isFinite(price) &&
          price > 0
      );

    if (validPrices.length === 0)
      return 0;

    return (
      validPrices.reduce(
        (sum, price) =>
          sum + price,
        0
      ) / validPrices.length
    );
  }, [products]);

  const customerValueRows = useMemo(() => {
    return performanceRows.map(
      ({ product, performance }) => {
        const relativePerformance =
          averagePerformance > 0
            ? performance /
              averagePerformance
            : 0;

        const priceRelative =
          averagePrice > 0
            ? product.price /
              averagePrice
            : 0;

        const relativeCustomerValue =
          priceRelative > 0
            ? relativePerformance /
              priceRelative
            : 0;

        return {
          product,
          performance,
          relativePerformance,
          priceRelative,
          relativeCustomerValue,
        };
      }
    );
  }, [
    performanceRows,
    averagePerformance,
    averagePrice,
  ]);

  const bestProduct = useMemo(() => {
    if (
      customerValueRows.length === 0
    ) {
      return null;
    }

    return [...customerValueRows].sort(
      (a, b) =>
        b.relativeCustomerValue -
        a.relativeCustomerValue
    )[0];
  }, [customerValueRows]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f8fc]">
        <p className="text-lg font-semibold text-[#60788A]">
          Calculating Customer Value...
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
        <p className="text-sm font-bold uppercase tracking-[0.3em] text-[#4EA3E3]">
          {projectName || 'MPV Project'}
        </p>

        <h2 className="mt-2 text-4xl font-bold">
          Product Evaluation
        </h2>

        {/* NAVIGATION */}
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
              onClick={() =>
                router.push(
                  `/project/${projectId}/comparison`
                )
              }
            />

            <ModuleButton
              number="4"
              label="Customer Value"
              active
              onClick={() =>
                router.push(
                  `/project/${projectId}/customer-value`
                )
              }
            />

            <ModuleButton
              number="5"
              label="GPP"
              onClick={() =>
                router.push(
                  `/project/${projectId}/gpp`
                )
              }
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
            Module 4
          </p>

          <h3 className="mt-3 text-4xl font-bold">
            Customer Value
          </h3>

          <p className="mt-4 max-w-4xl text-lg leading-8 text-[#60788A]">
            The normalized MPV performance is combined
            with the parameter weights and compared
            with the average market performance and
            price.
          </p>
        </section>

        {/* FORMULAS */}
        <section className="mt-8 grid gap-4 lg:grid-cols-4">
          <FormulaCard
            title="Performance MPV"
            formula="Σ(Points × Weight) / 10"
          />

          <FormulaCard
            title="Relative Performance"
            formula="P / Average P"
          />

          <FormulaCard
            title="Price Relative"
            formula="Price / Average Price"
          />

          <FormulaCard
            title="Relative Customer Value"
            formula="Relative P / Relative Price"
          />
        </section>

        {/* SUMMARY */}
        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <SummaryCard
            label="Average Performance"
            value={averagePerformance.toFixed(
              2
            )}
          />

          <SummaryCard
            label="Average Market Price"
            value={formatMoney(
              averagePrice
            )}
          />

          <SummaryCard
            label="Highest RCV"
            value={
              bestProduct
                ? bestProduct.relativeCustomerValue.toFixed(
                    2
                  )
                : '—'
            }
            subtitle={
              bestProduct?.product.name
            }
          />
        </section>

        {/* TABLE */}
        <section className="mt-6 rounded-3xl border border-[#dbe8f2] bg-white p-7 shadow-sm">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#4EA3E3]">
              Automated calculation
            </p>

            <h4 className="mt-2 text-2xl font-bold">
              Relative Customer Value
            </h4>

            <p className="mt-3 text-[#60788A]">
              Values above 1.00 indicate customer
              value above the market average.
              Values below 1.00 indicate value below
              the market average.
            </p>
          </div>

          <div className="mt-7 overflow-x-auto">
            <table className="w-full min-w-[1000px] border-collapse">
              <thead>
                <tr className="bg-[#153A5B] text-white">
                  <th className="p-4 text-left">
                    Brand / Product
                  </th>

                  <th className="p-4 text-center">
                    Performance MPV (P)
                  </th>

                  <th className="p-4 text-center">
                    Relative Performance
                  </th>

                  <th className="p-4 text-center">
                    Price Relative
                  </th>

                  <th className="p-4 text-center">
                    Relative Customer Value
                  </th>
                </tr>
              </thead>

              <tbody>
                {customerValueRows.map(
                  (row) => (
                    <tr
                      key={row.product.id}
                      className="border-b border-[#dbe8f2]"
                    >
                      <td className="p-4 font-bold">
                        {row.product.name}

                        <div className="mt-1 text-sm font-normal text-[#60788A]">
                          Price:{' '}
                          {formatMoney(
                            row.product.price
                          )}
                        </div>
                      </td>

                      <td className="p-4 text-center font-semibold">
                        {row.performance.toFixed(
                          2
                        )}
                      </td>

                      <td className="p-4 text-center font-semibold">
                        {row.relativePerformance.toFixed(
                          2
                        )}
                      </td>

                      <td className="p-4 text-center font-semibold">
                        {row.priceRelative.toFixed(
                          2
                        )}
                      </td>

                      <td className="p-4 text-center">
                        <span
                          className={`inline-flex min-w-[70px] justify-center rounded-xl px-4 py-2 text-lg font-bold ${
                            row.relativeCustomerValue >=
                            1
                              ? 'bg-green-100 text-green-700'
                              : 'bg-orange-100 text-orange-700'
                          }`}
                        >
                          {row.relativeCustomerValue.toFixed(
                            2
                          )}
                        </span>
                      </td>
                    </tr>
                  )
                )}

                <tr className="bg-[#eef5df] font-bold">
                  <td className="p-4">
                    Average of competitors
                  </td>

                  <td className="p-4 text-center">
                    {averagePerformance.toFixed(
                      2
                    )}
                  </td>

                  <td className="p-4 text-center">
                    1.00
                  </td>

                  <td className="p-4 text-center">
                    1.00
                  </td>

                  <td className="p-4 text-center">
                    —
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* INTERPRETATION */}
        <section className="mt-6 rounded-3xl bg-[#153A5B] p-7 text-white">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#6bc1ff]">
            Interpretation
          </p>

          <h4 className="mt-2 text-2xl font-bold">
            How to read RCV
          </h4>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <InterpretationCard
              value="> 1.00"
              text="Customer value is above the market average."
            />

            <InterpretationCard
              value="= 1.00"
              text="Customer value is approximately equal to the market average."
            />

            <InterpretationCard
              value="< 1.00"
              text="Customer value is below the market average."
            />
          </div>
        </section>

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
                `/project/${projectId}/comparison`
              )
            }
            className="w-full rounded-xl border border-[#cbdde9] bg-white px-6 py-4 font-bold"
          >
            ← Back to MPV Points
          </button>

          <button
            onClick={() =>
              router.push(
                `/project/${projectId}/gpp`
              )
            }
            className="mt-3 w-full rounded-xl bg-[#4EA3E3] px-6 py-4 font-bold text-white"
          >
            Continue to Gross Profit Potential →
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
      className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-4 text-sm font-bold ${
        active
          ? 'bg-[#17496D] text-white'
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

function FormulaCard({
  title,
  formula,
}: {
  title: string;
  formula: string;
}) {
  return (
    <div className="rounded-2xl border border-[#dbe8f2] bg-white p-5 shadow-sm">
      <p className="text-sm font-bold text-[#4EA3E3]">
        {title}
      </p>

      <p className="mt-3 font-mono text-sm font-bold text-[#153A5B]">
        {formula}
      </p>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-2xl border border-[#dbe8f2] bg-white p-6 shadow-sm">
      <p className="text-sm text-[#60788A]">
        {label}
      </p>

      <p className="mt-2 text-3xl font-bold">
        {value}
      </p>

      {subtitle && (
        <p className="mt-2 text-sm font-semibold text-[#4EA3E3]">
          {subtitle}
        </p>
      )}
    </div>
  );
}

function InterpretationCard({
  value,
  text,
}: {
  value: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl bg-white/10 p-5">
      <p className="text-2xl font-bold text-[#6bc1ff]">
        {value}
      </p>

      <p className="mt-2 text-sm leading-6 text-[#d9e7f1]">
        {text}
      </p>
    </div>
  );
}

function formatMoney(value: number) {
  if (!Number.isFinite(value)) {
    return '—';
  }

  return value.toLocaleString(
    'pl-PL',
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  );
}