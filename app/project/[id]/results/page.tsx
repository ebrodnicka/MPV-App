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

  market_size: number | null;
  market_growth: number | null;
  time_horizon: number | null;

  // W bazie np. 0.40 = 40%
  gross_margin: number | null;
};

type RawValueMap = Record<string, number>;

type ResultRow = {
  product: Product;

  performance: number;
  relativePerformance: number;
  priceRelative: number;
  rcv: number;

  gpp: number | null;

  position:
    | 'Strategic Leader'
    | 'Customer Value Leader'
    | 'Profit Potential'
    | 'Lower Priority';
};

export default function ResultsPage() {
  const params = useParams();
  const router = useRouter();

  const projectId = params.id as string;

  const [projectName, setProjectName] = useState('');
  const [projectStatus, setProjectStatus] = useState('');

  const [parameters, setParameters] = useState<Parameter[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [rawValues, setRawValues] = useState<RawValueMap>({});

  const [loading, setLoading] = useState(true);
  const [finishing, setFinishing] = useState(false);

  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadPage();
  }, [projectId]);

  function valueKey(productId: string, parameterId: string) {
    return `${productId}__${parameterId}`;
  }

  async function loadPage() {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      // =========================
      // PROJECT
      // =========================

      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('name, status')
        .eq('id', projectId)
        .single();

      if (projectError) {
        throw projectError;
      }

      setProjectName(project?.name ?? '');
      setProjectStatus(project?.status ?? '');

      // =========================
      // PARAMETERS
      // =========================

      const { data: parameterRows, error: parameterError } =
        await supabase
          .from('parameters')
          .select(
            `
            id,
            name,
            unit,
            indicator_type,
            weight,
            sort_order
            `
          )
          .eq('project_id', projectId)
          .order('sort_order', { ascending: true });

      if (parameterError) {
        throw parameterError;
      }

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

      // =========================
      // PRODUCTS
      // =========================

      const { data: productRows, error: productError } =
        await supabase
          .from('products')
          .select(
            `
            id,
            name,
            price,
            sort_order,
            market_size,
            market_growth,
            time_horizon,
            gross_margin
            `
          )
          .eq('project_id', projectId)
          .order('sort_order', { ascending: true });

      if (productError) {
        throw productError;
      }

      const loadedProducts: Product[] = (productRows ?? []).map(
        (row: any, index: number) => ({
          id: row.id,
          name: row.name ?? '',
          price: Number(row.price ?? 0),
          sort_order: Number(row.sort_order ?? index),

          market_size:
            row.market_size === null ||
            row.market_size === undefined
              ? null
              : Number(row.market_size),

          market_growth:
            row.market_growth === null ||
            row.market_growth === undefined
              ? null
              : Number(row.market_growth),

          time_horizon:
            row.time_horizon === null ||
            row.time_horizon === undefined
              ? null
              : Number(row.time_horizon),

          gross_margin:
            row.gross_margin === null ||
            row.gross_margin === undefined
              ? null
              : Number(row.gross_margin),
        })
      );

      setProducts(loadedProducts);

      // =========================
      // RAW VALUES
      // =========================

      if (loadedProducts.length > 0) {
        const productIds = loadedProducts.map(
          (product) => product.id
        );

        const { data: valueRows, error: valueError } =
          await supabase
            .from('product_parameter_values')
            .select(
              `
              product_id,
              parameter_id,
              raw_value
              `
            )
            .in('product_id', productIds);

        if (valueError) {
          throw valueError;
        }

        const loadedValues: RawValueMap = {};

        (valueRows ?? []).forEach((row: any) => {
          loadedValues[
            valueKey(row.product_id, row.parameter_id)
          ] = Number(row.raw_value);
        });

        setRawValues(loadedValues);
      }
    } catch (err: any) {
      console.error('RESULTS LOAD ERROR:', err);

      setError(
        err?.message ||
          err?.details ||
          err?.hint ||
          'Results could not be loaded.'
      );
    } finally {
      setLoading(false);
    }
  }

  // =========================================================
  // MAX / MIN FOR EVERY PARAMETER
  // =========================================================

  const statistics = useMemo(() => {
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

  // =========================================================
  // MPV POINTS
  // =========================================================

  function calculateMPVPoints(
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

    // Stimulant — more is better
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

    // Destimulant — less is better
    if (
      min === null ||
      raw === 0
    ) {
      return 0;
    }

    return (min / raw) * 10;
  }

  // =========================================================
  // PERFORMANCE MPV
  // =========================================================

  const performanceRows = useMemo(() => {
    return products.map((product) => {
      let weightedSum = 0;

      parameters.forEach((parameter) => {
        const points =
          calculateMPVPoints(
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

  // =========================================================
  // MARKET AVERAGES
  // =========================================================

  const averagePerformance = useMemo(() => {
    const values = performanceRows
      .map((row) => row.performance)
      .filter(
        (value) =>
          Number.isFinite(value) &&
          value > 0
      );

    if (values.length === 0) {
      return 0;
    }

    return (
      values.reduce(
        (sum, value) =>
          sum + value,
        0
      ) / values.length
    );
  }, [performanceRows]);

  const averagePrice = useMemo(() => {
    const values = products
      .map((product) => product.price)
      .filter(
        (value) =>
          Number.isFinite(value) &&
          value > 0
      );

    if (values.length === 0) {
      return 0;
    }

    return (
      values.reduce(
        (sum, value) =>
          sum + value,
        0
      ) / values.length
    );
  }, [products]);

  // =========================================================
  // GPP
  // =========================================================

  function calculateGPP(
    product: Product
  ): number | null {
    if (
      product.market_size === null ||
      product.market_growth === null ||
      product.time_horizon === null ||
      product.gross_margin === null
    ) {
      return null;
    }

    if (
      !Number.isFinite(product.market_size) ||
      !Number.isFinite(product.market_growth) ||
      !Number.isFinite(product.time_horizon) ||
      !Number.isFinite(product.gross_margin)
    ) {
      return null;
    }

    const growth =
      product.market_growth / 100;

    // Gross margin in database:
    // 0.40 = 40%
    const margin =
      product.gross_margin;

    return (
      product.market_size *
      Math.pow(
        1 + growth,
        product.time_horizon
      ) *
      margin
    );
  }

  const averageGPP = useMemo(() => {
    const values = products
      .map((product) =>
        calculateGPP(product)
      )
      .filter(
        (value): value is number =>
          value !== null &&
          Number.isFinite(value)
      );

    if (values.length === 0) {
      return 0;
    }

    return (
      values.reduce(
        (sum, value) =>
          sum + value,
        0
      ) / values.length
    );
  }, [products]);

  // =========================================================
  // FINAL RESULTS
  // =========================================================

  const results: ResultRow[] = useMemo(() => {
    return performanceRows.map(
      ({ product, performance }) => {
        const relativePerformance =
          averagePerformance > 0
            ? performance /
              averagePerformance
            : 0;

        const priceRelative =
          averagePrice > 0 &&
          product.price > 0
            ? product.price /
              averagePrice
            : 0;

        const rcv =
          priceRelative > 0
            ? relativePerformance /
              priceRelative
            : 0;

        const gpp =
          calculateGPP(product);

        let position: ResultRow['position'] =
          'Lower Priority';

        if (
          rcv >= 1 &&
          gpp !== null &&
          gpp >= averageGPP
        ) {
          position =
            'Strategic Leader';
        } else if (
          rcv >= 1 &&
          (gpp === null ||
            gpp < averageGPP)
        ) {
          position =
            'Customer Value Leader';
        } else if (
          rcv < 1 &&
          gpp !== null &&
          gpp >= averageGPP
        ) {
          position =
            'Profit Potential';
        }

        return {
          product,
          performance,
          relativePerformance,
          priceRelative,
          rcv,
          gpp,
          position,
        };
      }
    );
  }, [
    performanceRows,
    averagePerformance,
    averagePrice,
    averageGPP,
    products,
  ]);

  // =========================================================
  // SUMMARY
  // =========================================================

  const highestRCV = useMemo(() => {
    if (results.length === 0) {
      return null;
    }

    return [...results].sort(
      (a, b) =>
        b.rcv - a.rcv
    )[0];
  }, [results]);

  const highestGPP = useMemo(() => {
    const valid = results.filter(
      (
        row
      ): row is ResultRow & {
        gpp: number;
      } =>
        row.gpp !== null &&
        Number.isFinite(row.gpp)
    );

    if (valid.length === 0) {
      return null;
    }

    return [...valid].sort(
      (a, b) =>
        b.gpp - a.gpp
    )[0];
  }, [results]);

  const strategicLeaders = useMemo(() => {
    return results.filter(
      (row) =>
        row.position ===
        'Strategic Leader'
    );
  }, [results]);

  // =========================================================
  // FINISH PROJECT
  // =========================================================

  async function finishAnalysis() {
    setFinishing(true);
    setError('');
    setMessage('');

    try {
      /*
        Najpierw próbujemy "completed".
        Jeżeli projekt ma ograniczenie wymagające
        "Completed", próbujemy drugi wariant.
      */

      const { error: firstError } =
        await supabase
          .from('projects')
          .update({
            status: 'completed',
          })
          .eq('id', projectId);

      if (firstError) {
        const { error: secondError } =
          await supabase
            .from('projects')
            .update({
              status: 'Completed',
            })
            .eq('id', projectId);

        if (secondError) {
          throw secondError;
        }
      }

      setProjectStatus('completed');

      setMessage(
        'Analysis completed successfully ✅'
      );

      /*
        Krótki timeout pozwala zobaczyć
        komunikat sukcesu zanim wrócimy
        do My Projects.
      */
      setTimeout(() => {
        router.push('/dashboard');
      }, 700);
    } catch (err: any) {
      console.error(
        'FINISH ANALYSIS ERROR:',
        err
      );

      setError(
        err?.message ||
          err?.details ||
          err?.hint ||
          'The analysis could not be completed.'
      );
    } finally {
      setFinishing(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f8fc]">
        <p className="text-lg font-semibold text-[#60788A]">
          Preparing final results...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f8fc] text-[#153A5B]">
      {/* =====================================================
          HEADER
      ====================================================== */}

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
        {/* =====================================================
            PROJECT
        ====================================================== */}

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.3em] text-[#4EA3E3]">
              {projectName ||
                'MPV Project'}
            </p>

            <h2 className="mt-2 text-4xl font-bold">
              Final Results
            </h2>
          </div>

          <StatusBadge
            status={projectStatus}
          />
        </div>

        {/* =====================================================
            MODULE NAVIGATION
        ====================================================== */}

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
              active
              onClick={() => {}}
            />
          </div>
        </div>

        {/* =====================================================
            INTRO
        ====================================================== */}

        <section className="mt-8">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-[#4EA3E3]">
            Module 6
          </p>

          <h3 className="mt-3 text-4xl font-bold">
            Market Opportunity Landscape
          </h3>

          <p className="mt-4 max-w-4xl text-lg leading-8 text-[#60788A]">
            Final product evaluation combining
            relative customer value with gross
            profit potential.
          </p>
        </section>

        {/* =====================================================
            SUMMARY CARDS
        ====================================================== */}

        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Products analysed"
            value={String(
              results.length
            )}
          />

          <SummaryCard
            label="Highest Customer Value"
            value={
              highestRCV
                ? highestRCV.rcv.toFixed(
                    2
                  )
                : '—'
            }
            subtitle={
              highestRCV?.product.name
            }
          />

          <SummaryCard
            label="Highest GPP"
            value={
              highestGPP
                ? `${highestGPP.gpp.toFixed(
                    2
                  )} mln PLN`
                : '—'
            }
            subtitle={
              highestGPP?.product.name
            }
          />

          <SummaryCard
            label="Strategic Leaders"
            value={String(
              strategicLeaders.length
            )}
            subtitle="High RCV + High GPP"
          />
        </section>

        {/* =====================================================
            CHART
        ====================================================== */}

        <section className="mt-6 rounded-3xl border border-[#dbe8f2] bg-white p-7 shadow-sm">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#4EA3E3]">
              Market Landscape
            </p>

            <h4 className="mt-2 text-2xl font-bold">
              RCV vs Gross Profit Potential
            </h4>

            <p className="mt-3 max-w-4xl text-[#60788A]">
              Products positioned to the right
              provide customer value above the
              market benchmark. Products above
              the horizontal benchmark have
              Gross Profit Potential above the
              analysed market average.
            </p>
          </div>

          <div className="mt-7">
            <MarketLandscapeChart
              results={results}
              averageGPP={averageGPP}
            />
          </div>

          {/* LEGEND */}
          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <LegendCard
              title="Strategic Leader"
              text="Above-market customer value and above-average profit potential."
              symbol="↗"
            />

            <LegendCard
              title="Customer Value Leader"
              text="Strong customer value with below-average profit potential."
              symbol="→"
            />

            <LegendCard
              title="Profit Potential"
              text="Strong financial potential but below-market customer value."
              symbol="↑"
            />

            <LegendCard
              title="Lower Priority"
              text="Below both strategic benchmarks."
              symbol="·"
            />
          </div>
        </section>

        {/* =====================================================
            RESULTS TABLE
        ====================================================== */}

        <section className="mt-6 rounded-3xl border border-[#dbe8f2] bg-white p-7 shadow-sm">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#4EA3E3]">
              Final Evaluation
            </p>

            <h4 className="mt-2 text-2xl font-bold">
              Product Results
            </h4>
          </div>

          <div className="mt-7 overflow-x-auto">
            <table className="w-full min-w-[1200px] border-collapse">
              <thead>
                <tr className="bg-[#153A5B] text-white">
                  <th className="p-4 text-left">
                    Product
                  </th>

                  <th className="p-4 text-center">
                    Performance MPV
                  </th>

                  <th className="p-4 text-center">
                    Relative Performance
                  </th>

                  <th className="p-4 text-center">
                    Price Relative
                  </th>

                  <th className="p-4 text-center">
                    RCV
                  </th>

                  <th className="p-4 text-center">
                    GPP
                  </th>

                  <th className="p-4 text-center">
                    Market Position
                  </th>
                </tr>
              </thead>

              <tbody>
                {results.map(
                  (row) => (
                    <tr
                      key={row.product.id}
                      className="border-b border-[#dbe8f2]"
                    >
                      <td className="p-4">
                        <p className="font-bold">
                          {
                            row.product
                              .name
                          }
                        </p>

                        <p className="mt-1 text-sm text-[#60788A]">
                          Price:{' '}
                          {formatMoney(
                            row.product
                              .price
                          )}{' '}
                          PLN
                        </p>
                      </td>

                      <td className="p-4 text-center font-semibold">
                        {row.performance.toFixed(
                          2
                        )}
                      </td>

                      <td className="p-4 text-center">
                        {row.relativePerformance.toFixed(
                          2
                        )}
                      </td>

                      <td className="p-4 text-center">
                        {row.priceRelative.toFixed(
                          2
                        )}
                      </td>

                      <td className="p-4 text-center">
                        <span
                          className={`inline-flex min-w-[70px] justify-center rounded-xl px-3 py-2 font-bold ${
                            row.rcv >= 1
                              ? 'bg-green-100 text-green-700'
                              : 'bg-orange-100 text-orange-700'
                          }`}
                        >
                          {row.rcv.toFixed(
                            2
                          )}
                        </span>
                      </td>

                      <td className="p-4 text-center">
                        {row.gpp === null
                          ? '—'
                          : `${row.gpp.toFixed(
                              2
                            )} mln PLN`}
                      </td>

                      <td className="p-4 text-center">
                        <PositionBadge
                          position={
                            row.position
                          }
                        />
                      </td>
                    </tr>
                  )
                )}

                {/* BENCHMARK */}
                <tr className="bg-[#eef5df] font-bold">
                  <td className="p-4">
                    Market Benchmark
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
                    1.00
                  </td>

                  <td className="p-4 text-center">
                    {averageGPP.toFixed(
                      2
                    )}{' '}
                    mln PLN
                  </td>

                  <td className="p-4 text-center">
                    —
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* =====================================================
            STRATEGIC INTERPRETATION
        ====================================================== */}

        <section className="mt-6 rounded-3xl bg-[#153A5B] p-7 text-white">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#6bc1ff]">
            Strategic Interpretation
          </p>

          <h4 className="mt-2 text-2xl font-bold">
            How to interpret the results
          </h4>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <InfoCard
              title="Relative Customer Value"
              text="RCV above 1.00 means that the product provides customer value above the market benchmark after considering performance and price."
            />

            <InfoCard
              title="Gross Profit Potential"
              text="GPP represents the estimated financial opportunity based on market size, expected growth, planning horizon and gross margin."
            />

            <InfoCard
              title="Horizontal benchmark"
              text={`The horizontal benchmark is the average GPP of the analysed products: ${averageGPP.toFixed(
                2
              )} mln PLN.`}
            />

            <InfoCard
              title="Vertical benchmark"
              text="The vertical benchmark is RCV = 1.00, representing the market reference level for customer value."
            />
          </div>
        </section>

        {/* =====================================================
            LEADERS
        ====================================================== */}

        {strategicLeaders.length > 0 && (
          <section className="mt-6 rounded-3xl border border-green-200 bg-green-50 p-7">
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-green-700">
              Strategic Leaders
            </p>

            <h4 className="mt-2 text-2xl font-bold text-[#153A5B]">
              Strongest market positions
            </h4>

            <p className="mt-3 text-[#60788A]">
              These products exceed both
              strategic reference levels.
            </p>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {strategicLeaders.map(
                (row) => (
                  <div
                    key={row.product.id}
                    className="rounded-2xl bg-white p-5"
                  >
                    <p className="font-bold text-[#153A5B]">
                      {
                        row.product
                          .name
                      }
                    </p>

                    <div className="mt-3 flex flex-wrap gap-4 text-sm">
                      <span>
                        RCV:{' '}
                        <strong>
                          {row.rcv.toFixed(
                            2
                          )}
                        </strong>
                      </span>

                      <span>
                        GPP:{' '}
                        <strong>
                          {row.gpp?.toFixed(
                            2
                          )}{' '}
                          mln PLN
                        </strong>
                      </span>
                    </div>
                  </div>
                )
              )}
            </div>
          </section>
        )}

        {/* =====================================================
            ERROR / SUCCESS
        ====================================================== */}

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

        {/* =====================================================
            FINAL ACTIONS
        ====================================================== */}

        <section className="mt-8 border-t border-[#dbe8f2] pt-8">
          <button
            onClick={() =>
              router.push(
                `/project/${projectId}/gpp`
              )
            }
            disabled={finishing}
            className="w-full rounded-xl border border-[#cbdde9] bg-white px-6 py-4 font-bold transition hover:bg-[#f7fafc] disabled:opacity-50"
          >
            ← Back to Gross Profit Potential
          </button>

          <button
            onClick={() =>
              router.push(
                `/project/${projectId}/configuration`
              )
            }
            disabled={finishing}
            className="mt-3 w-full rounded-xl border border-[#cbdde9] bg-white px-6 py-4 font-bold transition hover:bg-[#f7fafc] disabled:opacity-50"
          >
            Edit Analysis
          </button>

          <button
            onClick={
              finishAnalysis
            }
            disabled={
              finishing ||
              results.length === 0
            }
            className="mt-3 w-full rounded-xl bg-[#17496D] px-6 py-4 font-bold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {finishing
              ? 'Completing Analysis...'
              : 'Finish Analysis & Return to My Projects ✓'}
          </button>

          <p className="mt-3 text-center text-sm text-[#60788A]">
            Finishing the analysis marks
            this project as completed.
          </p>
        </section>
      </div>
    </main>
  );
}

/* =========================================================
   MARKET LANDSCAPE CHART
========================================================= */

function MarketLandscapeChart({
  results,
  averageGPP,
}: {
  results: ResultRow[];
  averageGPP: number;
}) {
  const validResults = results.filter(
    (
      row
    ): row is ResultRow & {
      gpp: number;
    } =>
      row.gpp !== null &&
      Number.isFinite(row.gpp) &&
      Number.isFinite(row.rcv)
  );

  if (validResults.length === 0) {
    return (
      <div className="flex min-h-[350px] items-center justify-center rounded-2xl bg-[#f4f8fc] p-8 text-center text-[#60788A]">
        Complete the market data to
        display the final landscape.
      </div>
    );
  }

  /*
    SVG dimensions
  */

  const width = 900;
  const height = 520;

  const left = 90;
  const right = 40;
  const top = 45;
  const bottom = 75;

  const chartWidth =
    width - left - right;

  const chartHeight =
    height - top - bottom;

  /*
    X = RCV

    Dodajemy margines, żeby punkty
    nie znajdowały się na samych
    krawędziach wykresu.
  */

  const rcvValues =
    validResults.map(
      (row) => row.rcv
    );

  const rawMinRCV = Math.min(
    ...rcvValues,
    1
  );

  const rawMaxRCV = Math.max(
    ...rcvValues,
    1
  );

  const rcvRange =
    rawMaxRCV - rawMinRCV || 0.4;

  const minRCV = Math.max(
    0,
    rawMinRCV -
      rcvRange * 0.15
  );

  const maxRCV =
    rawMaxRCV +
    rcvRange * 0.15;

  /*
    Y = GPP
  */

  const gppValues =
    validResults.map(
      (row) => row.gpp
    );

  const maxRawGPP = Math.max(
    ...gppValues,
    averageGPP,
    1
  );

  const maxGPP =
    maxRawGPP * 1.15;

  const minGPP = 0;

  function scaleX(value: number) {
    return (
      left +
      ((value - minRCV) /
        (maxRCV - minRCV)) *
        chartWidth
    );
  }

  function scaleY(value: number) {
    return (
      top +
      chartHeight -
      ((value - minGPP) /
        (maxGPP - minGPP)) *
        chartHeight
    );
  }

  const benchmarkX =
    scaleX(1);

  const benchmarkY =
    scaleY(averageGPP);

  /*
    Axis ticks
  */

  const xTicks = Array.from(
    { length: 6 },
    (_, index) =>
      minRCV +
      ((maxRCV - minRCV) /
        5) *
        index
  );

  const yTicks = Array.from(
    { length: 6 },
    (_, index) =>
      (maxGPP / 5) *
      index
  );

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="min-w-[760px] w-full"
        role="img"
        aria-label="Relative Customer Value versus Gross Profit Potential"
      >
        {/* =====================
            QUADRANT BACKGROUNDS
        ====================== */}

        {/* TOP LEFT */}
        <rect
          x={left}
          y={top}
          width={Math.max(
            benchmarkX - left,
            0
          )}
          height={Math.max(
            benchmarkY - top,
            0
          )}
          fill="#fff7e6"
        />

        {/* TOP RIGHT */}
        <rect
          x={benchmarkX}
          y={top}
          width={Math.max(
            left +
              chartWidth -
              benchmarkX,
            0
          )}
          height={Math.max(
            benchmarkY - top,
            0
          )}
          fill="#ecf8ef"
        />

        {/* BOTTOM LEFT */}
        <rect
          x={left}
          y={benchmarkY}
          width={Math.max(
            benchmarkX - left,
            0
          )}
          height={Math.max(
            top +
              chartHeight -
              benchmarkY,
            0
          )}
          fill="#f7f9fb"
        />

        {/* BOTTOM RIGHT */}
        <rect
          x={benchmarkX}
          y={benchmarkY}
          width={Math.max(
            left +
              chartWidth -
              benchmarkX,
            0
          )}
          height={Math.max(
            top +
              chartHeight -
              benchmarkY,
            0
          )}
          fill="#eef7fd"
        />

        {/* =====================
            GRID
        ====================== */}

        {xTicks.map(
          (tick, index) => {
            const x =
              scaleX(tick);

            return (
              <g key={`x-${index}`}>
                <line
                  x1={x}
                  y1={top}
                  x2={x}
                  y2={
                    top +
                    chartHeight
                  }
                  stroke="#dbe8f2"
                  strokeWidth="1"
                />

                <text
                  x={x}
                  y={
                    top +
                    chartHeight +
                    28
                  }
                  textAnchor="middle"
                  fontSize="12"
                  fill="#60788A"
                >
                  {tick.toFixed(
                    2
                  )}
                </text>
              </g>
            );
          }
        )}

        {yTicks.map(
          (tick, index) => {
            const y =
              scaleY(tick);

            return (
              <g key={`y-${index}`}>
                <line
                  x1={left}
                  y1={y}
                  x2={
                    left +
                    chartWidth
                  }
                  y2={y}
                  stroke="#dbe8f2"
                  strokeWidth="1"
                />

                <text
                  x={left - 14}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="12"
                  fill="#60788A"
                >
                  {tick.toFixed(
                    2
                  )}
                </text>
              </g>
            );
          }
        )}

        {/* =====================
            BENCHMARK LINES
        ====================== */}

        <line
          x1={benchmarkX}
          y1={top}
          x2={benchmarkX}
          y2={
            top +
            chartHeight
          }
          stroke="#e05252"
          strokeWidth="2.5"
        />

        <line
          x1={left}
          y1={benchmarkY}
          x2={
            left +
            chartWidth
          }
          y2={benchmarkY}
          stroke="#e05252"
          strokeWidth="2.5"
        />

        {/* =====================
            AXES
        ====================== */}

        <line
          x1={left}
          y1={top}
          x2={left}
          y2={
            top +
            chartHeight
          }
          stroke="#153A5B"
          strokeWidth="2"
        />

        <line
          x1={left}
          y1={
            top +
            chartHeight
          }
          x2={
            left +
            chartWidth
          }
          y2={
            top +
            chartHeight
          }
          stroke="#153A5B"
          strokeWidth="2"
        />

        {/* =====================
            QUADRANT LABELS
        ====================== */}

        <text
          x={left + 14}
          y={top + 22}
          fontSize="12"
          fontWeight="700"
          fill="#956b20"
        >
          PROFIT POTENTIAL
        </text>

        <text
          x={
            left +
            chartWidth -
            14
          }
          y={top + 22}
          textAnchor="end"
          fontSize="12"
          fontWeight="700"
          fill="#287344"
        >
          STRATEGIC LEADERS
        </text>

        <text
          x={left + 14}
          y={
            top +
            chartHeight -
            14
          }
          fontSize="12"
          fontWeight="700"
          fill="#60788A"
        >
          LOWER PRIORITY
        </text>

        <text
          x={
            left +
            chartWidth -
            14
          }
          y={
            top +
            chartHeight -
            14
          }
          textAnchor="end"
          fontSize="12"
          fontWeight="700"
          fill="#2876a8"
        >
          CUSTOMER VALUE LEADERS
        </text>

        {/* =====================
            PRODUCTS
        ====================== */}

        {validResults.map(
          (row, index) => {
            const x =
              scaleX(row.rcv);

            const y =
              scaleY(row.gpp);

            const labelY =
              index % 2 === 0
                ? y - 13
                : y + 22;

            return (
              <g
                key={
                  row.product.id
                }
              >
                <circle
                  cx={x}
                  cy={y}
                  r="7"
                  fill="#17496D"
                  stroke="white"
                  strokeWidth="3"
                />

                <text
                  x={x + 10}
                  y={labelY}
                  fontSize="11"
                  fontWeight="700"
                  fill="#153A5B"
                >
                  {
                    row.product
                      .name
                  }
                </text>
              </g>
            );
          }
        )}

        {/* =====================
            AXIS TITLES
        ====================== */}

        <text
          x={
            left +
            chartWidth / 2
          }
          y={height - 18}
          textAnchor="middle"
          fontSize="14"
          fontWeight="700"
          fill="#153A5B"
        >
          Relative Customer Value (RCV)
        </text>

        <text
          transform={`translate(24 ${
            top +
            chartHeight / 2
          }) rotate(-90)`}
          textAnchor="middle"
          fontSize="14"
          fontWeight="700"
          fill="#153A5B"
        >
          Gross Profit Potential (mln PLN)
        </text>

        {/* =====================
            BENCHMARK LABELS
        ====================== */}

        <text
          x={
            benchmarkX + 7
          }
          y={
            top +
            chartHeight -
            30
          }
          fontSize="10"
          fill="#c43e3e"
        >
          RCV = 1.00
        </text>

        <text
          x={
            left +
            chartWidth -
            8
          }
          y={
            benchmarkY - 7
          }
          textAnchor="end"
          fontSize="10"
          fill="#c43e3e"
        >
          Avg GPP ={' '}
          {averageGPP.toFixed(
            2
          )}
        </text>
      </svg>
    </div>
  );
}

/* =========================================================
   SMALL COMPONENTS
========================================================= */

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
      className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-4 text-sm font-bold transition ${
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

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const completed =
    status.toLowerCase() ===
    'completed';

  return (
    <span
      className={`rounded-full px-4 py-2 text-sm font-bold ${
        completed
          ? 'bg-green-100 text-green-700'
          : 'bg-[#eef7fd] text-[#17496D]'
      }`}
    >
      {completed
        ? '✓ Completed'
        : 'Analysis in progress'}
    </span>
  );
}

function PositionBadge({
  position,
}: {
  position: ResultRow['position'];
}) {
  if (
    position ===
    'Strategic Leader'
  ) {
    return (
      <span className="inline-flex rounded-full bg-green-100 px-3 py-2 text-xs font-bold text-green-700">
        Strategic Leader
      </span>
    );
  }

  if (
    position ===
    'Customer Value Leader'
  ) {
    return (
      <span className="inline-flex rounded-full bg-blue-100 px-3 py-2 text-xs font-bold text-blue-700">
        Customer Value Leader
      </span>
    );
  }

  if (
    position ===
    'Profit Potential'
  ) {
    return (
      <span className="inline-flex rounded-full bg-yellow-100 px-3 py-2 text-xs font-bold text-yellow-700">
        Profit Potential
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full bg-gray-100 px-3 py-2 text-xs font-bold text-gray-600">
      Lower Priority
    </span>
  );
}

function LegendCard({
  title,
  text,
  symbol,
}: {
  title: string;
  text: string;
  symbol: string;
}) {
  return (
    <div className="rounded-2xl bg-[#f4f8fc] p-5">
      <p className="text-2xl font-bold text-[#4EA3E3]">
        {symbol}
      </p>

      <p className="mt-2 font-bold">
        {title}
      </p>

      <p className="mt-2 text-sm leading-6 text-[#60788A]">
        {text}
      </p>
    </div>
  );
}

function InfoCard({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl bg-white/10 p-5">
      <p className="font-bold text-[#6bc1ff]">
        {title}
      </p>

      <p className="mt-2 text-sm leading-6 text-[#d9e7f1]">
        {text}
      </p>
    </div>
  );
}

function formatMoney(
  value: number
) {
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