'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import supabase from '../../../../lib/supabase';

type Product = {
  id: string;
  name: string;
  price: number;
  sort_order: number;

  market_size: number | null;
  market_growth: number | null;
  time_horizon: number | null;

  // W aplikacji trzymamy np. 40 = 40%
  // W Supabase zapisujemy 0.40
  gross_margin: number | null;
};

export default function GPPPage() {
  const params = useParams();
  const router = useRouter();

  const projectId = params.id as string;

  const [projectName, setProjectName] = useState('');
  const [products, setProducts] = useState<Product[]>([]);

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
    setMessage('');

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      // PROJECT
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('name')
        .eq('id', projectId)
        .single();

      if (projectError) {
        throw projectError;
      }

      setProjectName(project?.name ?? '');

      // PRODUCTS
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

          // Supabase: 0.40
          // Aplikacja: 40
          gross_margin:
            row.gross_margin === null ||
            row.gross_margin === undefined
              ? null
              : Number(row.gross_margin) * 100,
        })
      );

      setProducts(loadedProducts);
    } catch (err: any) {
      console.error('LOAD ERROR:', err);

      setError(
        err?.message ||
          err?.details ||
          err?.hint ||
          'Gross Profit Potential could not be loaded.'
      );
    } finally {
      setLoading(false);
    }
  }

  function updateProduct(
    productId: string,
    field:
      | 'market_size'
      | 'market_growth'
      | 'time_horizon'
      | 'gross_margin',
    value: string
  ) {
    setProducts((currentProducts) =>
      currentProducts.map((product) =>
        product.id === productId
          ? {
              ...product,
              [field]:
                value === ''
                  ? null
                  : Number(value),
            }
          : product
      )
    );

    setError('');
    setMessage('');
  }

  function calculateGPP(product: Product): number | null {
    const {
      market_size,
      market_growth,
      time_horizon,
      gross_margin,
    } = product;

    if (
      market_size === null ||
      market_growth === null ||
      time_horizon === null ||
      gross_margin === null
    ) {
      return null;
    }

    if (
      !Number.isFinite(market_size) ||
      !Number.isFinite(market_growth) ||
      !Number.isFinite(time_horizon) ||
      !Number.isFinite(gross_margin)
    ) {
      return null;
    }

    // 10% -> 0.10
    const growthDecimal = market_growth / 100;

    // 40% -> 0.40
    const marginDecimal = gross_margin / 100;

    // GPP = M × (1 + ΔM)^N × GM
    return (
      market_size *
      Math.pow(1 + growthDecimal, time_horizon) *
      marginDecimal
    );
  }

  const gppRows = useMemo(() => {
    return products.map((product) => ({
      product,
      gpp: calculateGPP(product),
    }));
  }, [products]);

  const averageGPP = useMemo(() => {
    const validValues = gppRows
      .map((row) => row.gpp)
      .filter(
        (value): value is number =>
          value !== null &&
          Number.isFinite(value)
      );

    if (validValues.length === 0) {
      return 0;
    }

    const total = validValues.reduce(
      (sum, value) => sum + value,
      0
    );

    return total / validValues.length;
  }, [gppRows]);

  const highestGPP = useMemo(() => {
    const validRows = gppRows.filter(
      (row) =>
        row.gpp !== null &&
        Number.isFinite(row.gpp)
    );

    if (validRows.length === 0) {
      return null;
    }

    return [...validRows].sort(
      (a, b) =>
        Number(b.gpp) - Number(a.gpp)
    )[0];
  }, [gppRows]);

  const allDataComplete = useMemo(() => {
    if (products.length === 0) {
      return false;
    }

    return products.every(
      (product) =>
        product.market_size !== null &&
        product.market_growth !== null &&
        product.time_horizon !== null &&
        product.gross_margin !== null
    );
  }, [products]);

  async function saveGPP(goNext = false) {
    setSaving(true);
    setError('');
    setMessage('');

    try {
      if (products.length === 0) {
        throw new Error(
          'No products found.'
        );
      }

      // VALIDATION
      for (const product of products) {
        if (
          product.market_size === null ||
          !Number.isFinite(product.market_size) ||
          product.market_size < 0
        ) {
          throw new Error(
            `Enter a valid Market Size for ${product.name}.`
          );
        }

        if (
          product.market_growth === null ||
          !Number.isFinite(product.market_growth) ||
          product.market_growth <= -100
        ) {
          throw new Error(
            `Enter a valid Market Growth for ${product.name}.`
          );
        }

        if (
          product.time_horizon === null ||
          !Number.isFinite(product.time_horizon) ||
          product.time_horizon < 0
        ) {
          throw new Error(
            `Enter a valid Time Horizon for ${product.name}.`
          );
        }

        if (
          product.gross_margin === null ||
          !Number.isFinite(product.gross_margin) ||
          product.gross_margin < 0 ||
          product.gross_margin > 100
        ) {
          throw new Error(
            `Gross Margin for ${product.name} must be between 0 and 100%.`
          );
        }
      }

      // SAVE EVERY PRODUCT
      for (const product of products) {
        const { error: updateError } = await supabase
          .from('products')
          .update({
            market_size:
              product.market_size,

            market_growth:
              product.market_growth,

            time_horizon:
              product.time_horizon,

            // Aplikacja: 40
            // Supabase: 0.40
            gross_margin:
              product.gross_margin === null
                ? null
                : product.gross_margin / 100,
          })
          .eq('id', product.id)
          .eq('project_id', projectId);

        if (updateError) {
          throw updateError;
        }
      }

      setMessage(
        'Gross Profit Potential data saved successfully ✅'
      );

      if (goNext) {
        router.push(
          `/project/${projectId}/results`
        );
      }
    } catch (err: any) {
      console.error('SAVE ERROR:', err);

      setError(
        err?.message ||
          err?.details ||
          err?.hint ||
          'Gross Profit Potential could not be saved.'
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f8fc]">
        <p className="text-lg font-semibold text-[#60788A]">
          Loading Gross Profit Potential...
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
              active
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
            Module 5
          </p>

          <h3 className="mt-3 text-4xl font-bold">
            Gross Profit Potential
          </h3>

          <p className="mt-4 max-w-4xl text-lg leading-8 text-[#60788A]">
            Estimate the financial potential of each product
            using market size, expected market growth,
            planning horizon and gross margin.
          </p>
        </section>

        {/* FORMULA */}
        <section className="mt-8 rounded-3xl border border-[#dbe8f2] bg-white p-7 shadow-sm">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#4EA3E3]">
            Calculation Formula
          </p>

          <div className="mt-4 rounded-2xl bg-[#153A5B] p-7 text-center text-white">
            <p className="text-2xl font-bold">
              GPP = M × (1 + ΔM)
              <sup>N</sup> × GM
            </p>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <FormulaDefinition
              symbol="M"
              text="Current Market Size"
            />

            <FormulaDefinition
              symbol="ΔM"
              text="Annual Market Growth"
            />

            <FormulaDefinition
              symbol="N"
              text="Time Horizon"
            />

            <FormulaDefinition
              symbol="GM"
              text="Gross Margin"
            />
          </div>
        </section>

        {/* INPUT TABLE */}
        <section className="mt-6 rounded-3xl border border-[#dbe8f2] bg-white p-7 shadow-sm">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#4EA3E3]">
              Market Data
            </p>

            <h4 className="mt-2 text-2xl font-bold">
              Enter GPP assumptions
            </h4>

            <p className="mt-3 max-w-4xl text-[#60788A]">
              Enter the four market assumptions for each
              product. Gross Profit Potential is calculated
              automatically.
            </p>
          </div>

          <div className="mt-7 overflow-x-auto">
            <table className="w-full min-w-[1100px] border-collapse">
              <thead>
                <tr className="bg-[#153A5B] text-white">
                  <th className="p-4 text-left">
                    Product
                  </th>

                  <th className="p-4 text-center">
                    Market Size
                  </th>

                  <th className="p-4 text-center">
                    Market Growth
                  </th>

                  <th className="p-4 text-center">
                    Time Horizon
                  </th>

                  <th className="p-4 text-center">
                    Gross Margin
                  </th>

                  <th className="p-4 text-center">
                    GPP
                  </th>
                </tr>
              </thead>

              <tbody>
                {gppRows.map(
                  ({ product, gpp }) => (
                    <tr
                      key={product.id}
                      className="border-b border-[#dbe8f2]"
                    >
                      {/* PRODUCT */}
                      <td className="p-4">
                        <p className="font-bold">
                          {product.name}
                        </p>
                      </td>

                      {/* MARKET SIZE */}
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={
                              product.market_size ??
                              ''
                            }
                            onChange={(e) =>
                              updateProduct(
                                product.id,
                                'market_size',
                                e.target.value
                              )
                            }
                            placeholder="17.4"
                            className="w-full rounded-xl border border-[#cbdde9] px-3 py-3 text-right outline-none focus:border-[#4EA3E3]"
                          />

                          <span className="whitespace-nowrap text-sm text-[#60788A]">
                            mln PLN
                          </span>
                        </div>
                      </td>

                      {/* MARKET GROWTH */}
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="any"
                            value={
                              product.market_growth ??
                              ''
                            }
                            onChange={(e) =>
                              updateProduct(
                                product.id,
                                'market_growth',
                                e.target.value
                              )
                            }
                            placeholder="10"
                            className="w-full rounded-xl border border-[#cbdde9] px-3 py-3 text-right outline-none focus:border-[#4EA3E3]"
                          />

                          <span className="text-sm text-[#60788A]">
                            %
                          </span>
                        </div>
                      </td>

                      {/* TIME HORIZON */}
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={
                              product.time_horizon ??
                              ''
                            }
                            onChange={(e) =>
                              updateProduct(
                                product.id,
                                'time_horizon',
                                e.target.value
                              )
                            }
                            placeholder="3"
                            className="w-full rounded-xl border border-[#cbdde9] px-3 py-3 text-right outline-none focus:border-[#4EA3E3]"
                          />

                          <span className="whitespace-nowrap text-sm text-[#60788A]">
                            years
                          </span>
                        </div>
                      </td>

                      {/* GROSS MARGIN */}
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="any"
                            value={
                              product.gross_margin ??
                              ''
                            }
                            onChange={(e) =>
                              updateProduct(
                                product.id,
                                'gross_margin',
                                e.target.value
                              )
                            }
                            placeholder="40"
                            className="w-full rounded-xl border border-[#cbdde9] px-3 py-3 text-right outline-none focus:border-[#4EA3E3]"
                          />

                          <span className="text-sm text-[#60788A]">
                            %
                          </span>
                        </div>
                      </td>

                      {/* GPP */}
                      <td className="p-4 text-center">
                        <span className="inline-flex min-w-[100px] justify-center rounded-xl bg-[#eef7fd] px-4 py-3 text-lg font-bold text-[#17496D]">
                          {gpp === null
                            ? '—'
                            : gpp.toFixed(2)}
                        </span>

                        {gpp !== null && (
                          <p className="mt-1 text-xs text-[#60788A]">
                            mln PLN
                          </p>
                        )}
                      </td>
                    </tr>
                  )
                )}

                {/* AVERAGE */}
                <tr className="bg-[#eef5df] font-bold">
                  <td
                    className="p-4"
                    colSpan={5}
                  >
                    Average Gross Profit Potential
                  </td>

                  <td className="p-4 text-center">
                    <p className="text-lg">
                      {averageGPP.toFixed(2)}
                    </p>

                    <p className="text-xs font-normal text-[#60788A]">
                      mln PLN
                    </p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* SUMMARY */}
        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <SummaryCard
            label="Products"
            value={String(
              products.length
            )}
          />

          <SummaryCard
            label="Average GPP"
            value={
              products.length > 0
                ? `${averageGPP.toFixed(
                    2
                  )} mln PLN`
                : '—'
            }
          />

          <SummaryCard
            label="Highest GPP"
            value={
              highestGPP &&
              highestGPP.gpp !== null
                ? `${highestGPP.gpp.toFixed(
                    2
                  )} mln PLN`
                : '—'
            }
            subtitle={
              highestGPP?.product.name
            }
          />
        </section>

        {/* CALCULATION LOGIC */}
        <section className="mt-6 rounded-3xl bg-[#153A5B] p-7 text-white">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#6bc1ff]">
            Calculation Logic
          </p>

          <h4 className="mt-2 text-2xl font-bold">
            Gross Profit Potential
          </h4>

          <p className="mt-4 max-w-4xl leading-7 text-[#d9e7f1]">
            Gross Profit Potential estimates the financial
            potential of each product. The current market
            size is projected using the expected annual
            market growth over the selected time horizon
            and then multiplied by the expected gross
            margin.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-white/10 p-5">
              <p className="font-bold text-[#6bc1ff]">
                Market Growth
              </p>

              <p className="mt-2 text-sm leading-6 text-[#d9e7f1]">
                Enter the expected annual percentage
                change in market size.
              </p>
            </div>

            <div className="rounded-2xl bg-white/10 p-5">
              <p className="font-bold text-[#6bc1ff]">
                Gross Margin
              </p>

              <p className="mt-2 text-sm leading-6 text-[#d9e7f1]">
                Enter the margin as a percentage, for
                example 40 for 40%.
              </p>
            </div>
          </div>
        </section>

        {/* ERROR */}
        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
            {error}
          </div>
        )}

        {/* SUCCESS */}
        {message && (
          <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-5 text-green-700">
            {message}
          </div>
        )}

        {/* ACTIONS */}
        <section className="mt-8 border-t border-[#dbe8f2] pt-8">
          <button
            onClick={() =>
              router.push(
                `/project/${projectId}/customer-value`
              )
            }
            className="w-full rounded-xl border border-[#cbdde9] bg-white px-6 py-4 font-bold transition hover:bg-[#f7fafc]"
          >
            ← Back to Customer Value
          </button>

          <button
            onClick={() =>
              saveGPP(false)
            }
            disabled={
              saving ||
              products.length === 0
            }
            className="mt-3 w-full rounded-xl bg-[#17496D] px-6 py-4 font-bold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? 'Saving...'
              : 'Save GPP Data'}
          </button>

          <button
            onClick={() =>
              saveGPP(true)
            }
            disabled={
              saving ||
              !allDataComplete
            }
            className="mt-3 w-full rounded-xl bg-[#4EA3E3] px-6 py-4 font-bold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? 'Saving...'
              : 'Save & Continue to Results →'}
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

function FormulaDefinition({
  symbol,
  text,
}: {
  symbol: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl bg-[#f4f8fc] p-4">
      <p className="text-lg font-bold text-[#17496D]">
        {symbol}
      </p>

      <p className="mt-1 text-sm text-[#60788A]">
        {text}
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