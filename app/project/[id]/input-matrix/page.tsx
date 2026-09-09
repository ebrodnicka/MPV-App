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

type ValueMap = Record<string, string>;

export default function InputMatrixPage() {
  const params = useParams();
  const router = useRouter();

  const projectId = params.id as string;

  const [projectName, setProjectName] = useState('');
  const [parameters, setParameters] = useState<Parameter[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [values, setValues] = useState<ValueMap>({});

  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');

  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

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
        .select('id, name, unit, indicator_type, weight, sort_order')
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
          weight: Number(row.weight ?? 1),
          sort_order: Number(row.sort_order ?? index),
        })
      );

      setParameters(loadedParameters);

      const { data: productRows, error: productError } = await supabase
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
        const productIds = loadedProducts.map((product) => product.id);

        const { data: valueRows, error: valueError } = await supabase
          .from('product_parameter_values')
          .select('product_id, parameter_id, raw_value')
          .in('product_id', productIds);

        if (valueError) throw valueError;

        const loadedValues: ValueMap = {};

        (valueRows ?? []).forEach((row: any) => {
          loadedValues[valueKey(row.product_id, row.parameter_id)] =
            row.raw_value === null || row.raw_value === undefined
              ? ''
              : String(row.raw_value);
        });

        setValues(loadedValues);
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Input Matrix could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  async function addProduct() {
    setError('');
    setMessage('');

    if (!newProductName.trim()) {
      setError('Enter a product name.');
      return;
    }

    const parsedPrice = Number(newProductPrice);

    if (
      newProductPrice.trim() === '' ||
      !Number.isFinite(parsedPrice) ||
      parsedPrice < 0
    ) {
      setError('Enter a valid product price.');
      return;
    }

    setAdding(true);

    try {
      const { data, error: insertError } = await supabase
        .from('products')
        .insert({
          project_id: projectId,
          name: newProductName.trim(),
          price: parsedPrice,
          sort_order: products.length,
        })
        .select('id, name, price, sort_order')
        .single();

      if (insertError) throw insertError;

      setProducts((current) => [
        ...current,
        {
          id: data.id,
          name: data.name,
          price: Number(data.price ?? 0),
          sort_order: Number(data.sort_order ?? current.length),
        },
      ]);

      setNewProductName('');
      setNewProductPrice('');

      setMessage('Product added successfully.');
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Product could not be added.');
    } finally {
      setAdding(false);
    }
  }

  function updateProductName(productId: string, name: string) {
    setProducts((current) =>
      current.map((product) =>
        product.id === productId ? { ...product, name } : product
      )
    );
  }

  function updateProductPrice(productId: string, price: string) {
    setProducts((current) =>
      current.map((product) =>
        product.id === productId
          ? {
              ...product,
              price: price === '' ? null : Number(price),
            }
          : product
      )
    );
  }

  function updateRawValue(
    productId: string,
    parameterId: string,
    value: string
  ) {
    setValues((current) => ({
      ...current,
      [valueKey(productId, parameterId)]: value,
    }));

    setMessage('');
  }

  async function deleteProduct(productId: string) {
    setError('');
    setMessage('');

    try {
      const { error: deleteError } = await supabase
        .from('products')
        .delete()
        .eq('id', productId)
        .eq('project_id', projectId);

      if (deleteError) throw deleteError;

      setProducts((current) =>
        current
          .filter((product) => product.id !== productId)
          .map((product, index) => ({
            ...product,
            sort_order: index,
          }))
      );

      setValues((current) => {
        const next: ValueMap = {};

        Object.entries(current).forEach(([key, value]) => {
          if (!key.startsWith(`${productId}__`)) {
            next[key] = value;
          }
        });

        return next;
      });

      setMessage('Product removed.');
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Product could not be removed.');
    }
  }

  const statistics = useMemo(() => {
    return parameters.map((parameter) => {
      const numbers = products
        .map((product) => {
          const raw = values[valueKey(product.id, parameter.id)];

          if (raw === undefined || raw === '') return null;

          const number = Number(raw);

          return Number.isFinite(number) ? number : null;
        })
        .filter((value): value is number => value !== null);

      return {
        parameterId: parameter.id,
        max: numbers.length > 0 ? Math.max(...numbers) : null,
        min: numbers.length > 0 ? Math.min(...numbers) : null,
      };
    });
  }, [parameters, products, values]);

  function getStatistic(
    parameterId: string,
    type: 'max' | 'min'
  ): number | null {
    const statistic = statistics.find(
      (item) => item.parameterId === parameterId
    );

    return statistic ? statistic[type] : null;
  }

  async function saveMatrix(goNext = false) {
    setSaving(true);
    setError('');
    setMessage('');

    try {
      if (parameters.length === 0) {
        throw new Error('No parameters have been configured.');
      }

      if (products.length < 2) {
        throw new Error('Add at least two products before continuing.');
      }

      for (const product of products) {
        if (!product.name.trim()) {
          throw new Error('Every product must have a name.');
        }

        if (
          product.price === null ||
          !Number.isFinite(product.price) ||
          product.price < 0
        ) {
          throw new Error(
            `Enter a valid price for ${product.name || 'every product'}.`
          );
        }

        for (const parameter of parameters) {
          const raw = values[valueKey(product.id, parameter.id)];

          if (raw === undefined || raw.trim() === '') {
            throw new Error(
              `Enter ${parameter.name} for ${product.name}.`
            );
          }

          const number = Number(raw);

          if (!Number.isFinite(number)) {
            throw new Error(
              `${parameter.name} for ${product.name} must be numeric.`
            );
          }

          if (number < 0) {
            throw new Error(
              `${parameter.name} for ${product.name} cannot be negative.`
            );
          }
        }
      }

      for (let index = 0; index < products.length; index++) {
        const product = products[index];

        const { error: updateError } = await supabase
          .from('products')
          .update({
            name: product.name.trim(),
            price: product.price,
            sort_order: index,
          })
          .eq('id', product.id)
          .eq('project_id', projectId);

        if (updateError) throw updateError;
      }

      const productIds = products.map((product) => product.id);

      const { error: clearError } = await supabase
        .from('product_parameter_values')
        .delete()
        .in('product_id', productIds);

      if (clearError) throw clearError;

      const valueRows: {
        product_id: string;
        parameter_id: string;
        raw_value: number;
      }[] = [];

      products.forEach((product) => {
        parameters.forEach((parameter) => {
          valueRows.push({
            product_id: product.id,
            parameter_id: parameter.id,
            raw_value: Number(
              values[valueKey(product.id, parameter.id)]
            ),
          });
        });
      });

      if (valueRows.length > 0) {
        const { error: insertValueError } = await supabase
          .from('product_parameter_values')
          .insert(valueRows);

        if (insertValueError) throw insertValueError;
      }

      setMessage('Input Matrix saved successfully ✅');

      if (goNext) {
        router.push(`/project/${projectId}/comparison`);
      }
    } catch (err: any) {
      console.error('SAVE ERROR:', err);

      setError(
        err?.message ||
          err?.details ||
          err?.hint ||
          'Input Matrix could not be saved.'
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f8fc]">
        <p className="text-lg font-semibold text-[#60788A]">
          Loading Input Matrix...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f8fc] text-[#153A5B]">
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

        <div className="mt-8 overflow-x-auto rounded-2xl border border-[#dbe8f2] bg-white p-2">
          <div className="flex min-w-[700px] gap-2">
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
              label="Input Matrix"
              active
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
                router.push(`/project/${projectId}/results`)
              }
            />
          </div>
        </div>

        <section className="mt-8">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-[#4EA3E3]">
            Module 2
          </p>

          <h3 className="mt-3 text-4xl font-bold">
            Raw Market Data
          </h3>

          <p className="mt-4 max-w-4xl text-lg leading-8 text-[#60788A]">
            Enter verified raw technical data for each product.
            Values are not scored here. The application will
            automatically identify the maximum and minimum value
            for every parameter.
          </p>
        </section>

        <section className="mt-10 rounded-3xl border border-[#dbe8f2] bg-white p-7 shadow-sm">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#4EA3E3]">
            Products
          </p>

          <h4 className="mt-2 text-2xl font-bold">
            Add product
          </h4>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_220px_220px]">
            <div>
              <label className="mb-2 block text-sm font-bold">
                Product / Brand
              </label>

              <input
                value={newProductName}
                onChange={(e) =>
                  setNewProductName(e.target.value)
                }
                placeholder="e.g. Apple MacBook Air M3"
                className="w-full rounded-xl border border-[#cbdde9] px-4 py-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold">
                Market Price
              </label>

              <input
                type="number"
                min="0"
                step="any"
                value={newProductPrice}
                onChange={(e) =>
                  setNewProductPrice(e.target.value)
                }
                placeholder="e.g. 4999"
                className="w-full rounded-xl border border-[#cbdde9] px-4 py-3"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={addProduct}
                disabled={adding}
                className="w-full rounded-xl bg-[#17496D] px-5 py-3 font-bold text-white disabled:opacity-50"
              >
                {adding ? 'Adding...' : '+ Add Product'}
              </button>
            </div>
          </div>
        </section>

        {products.length > 0 && parameters.length > 0 && (
          <section className="mt-6 rounded-3xl border border-[#dbe8f2] bg-white p-7 shadow-sm">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#4EA3E3]">
                Raw Data
              </p>

              <h4 className="mt-2 text-2xl font-bold">
                Product Data Matrix
              </h4>

              <p className="mt-3 text-[#60788A]">
                Enter the original numerical values from
                specifications or verified market sources.
              </p>
            </div>

            <div className="mt-7 overflow-x-auto">
              <table className="min-w-max border-collapse">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-20 min-w-[240px] border border-[#dbe8f2] bg-[#153A5B] p-3 text-left text-white">
                      Brand / Parameters
                    </th>

                    {parameters.map((parameter) => (
                      <th
                        key={parameter.id}
                        className="min-w-[170px] border border-[#dbe8f2] bg-[#153A5B] p-3 text-center text-white"
                      >
                        <div>{parameter.name}</div>
                        <div className="mt-1 text-xs font-normal text-[#cfe4f2]">
                          {parameter.unit}
                        </div>
                      </th>
                    ))}

                    <th className="min-w-[170px] border border-[#dbe8f2] bg-[#153A5B] p-3 text-center text-white">
                      Price
                    </th>

                    <th className="min-w-[90px] border border-[#dbe8f2] bg-[#153A5B] p-3 text-center text-white">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {products.map((product) => (
                    <tr key={product.id}>
                      <td className="sticky left-0 z-10 border border-[#dbe8f2] bg-[#eef6fb] p-2">
                        <input
                          value={product.name}
                          onChange={(e) =>
                            updateProductName(
                              product.id,
                              e.target.value
                            )
                          }
                          className="w-full rounded-lg border border-[#cbdde9] bg-white px-3 py-2 font-semibold"
                        />
                      </td>

                      {parameters.map((parameter) => (
                        <td
                          key={parameter.id}
                          className="border border-[#dbe8f2] p-2"
                        >
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={
                              values[
                                valueKey(
                                  product.id,
                                  parameter.id
                                )
                              ] ?? ''
                            }
                            onChange={(e) =>
                              updateRawValue(
                                product.id,
                                parameter.id,
                                e.target.value
                              )
                            }
                            className="w-full rounded-lg border border-[#cbdde9] px-3 py-2 text-right"
                          />
                        </td>
                      ))}

                      <td className="border border-[#dbe8f2] p-2">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={product.price ?? ''}
                          onChange={(e) =>
                            updateProductPrice(
                              product.id,
                              e.target.value
                            )
                          }
                          className="w-full rounded-lg border border-[#cbdde9] px-3 py-2 text-right"
                        />
                      </td>

                      <td className="border border-[#dbe8f2] p-2 text-center">
                        <button
                          onClick={() =>
                            deleteProduct(product.id)
                          }
                          className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}

                  <tr className="bg-[#eef5df] font-bold">
                    <td className="sticky left-0 z-10 border border-[#dbe8f2] bg-[#eef5df] p-3">
                      MAX
                    </td>

                    {parameters.map((parameter) => (
                      <td
                        key={parameter.id}
                        className="border border-[#dbe8f2] p-3 text-right"
                      >
                        {formatValue(
                          getStatistic(parameter.id, 'max')
                        )}
                      </td>
                    ))}

                    <td
                      className="border border-[#dbe8f2]"
                      colSpan={2}
                    />
                  </tr>

                  <tr className="bg-[#eef5df] font-bold">
                    <td className="sticky left-0 z-10 border border-[#dbe8f2] bg-[#eef5df] p-3">
                      MIN
                    </td>

                    {parameters.map((parameter) => (
                      <td
                        key={parameter.id}
                        className="border border-[#dbe8f2] p-3 text-right"
                      >
                        {formatValue(
                          getStatistic(parameter.id, 'min')
                        )}
                      </td>
                    ))}

                    <td
                      className="border border-[#dbe8f2]"
                      colSpan={2}
                    />
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        )}

        {parameters.length === 0 && (
          <div className="mt-6 rounded-2xl border border-yellow-200 bg-yellow-50 p-5 text-yellow-800">
            No parameters found. Return to Configuration and
            create the evaluation parameters first.
          </div>
        )}

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

        <section className="mt-8 border-t border-[#dbe8f2] pt-8">
          <button
            onClick={() =>
              router.push(
                `/project/${projectId}/configuration`
              )
            }
            className="w-full rounded-xl border border-[#cbdde9] bg-white px-6 py-4 font-bold"
          >
            ← Back to Configuration
          </button>

          <button
            onClick={() => saveMatrix(false)}
            disabled={
              saving ||
              products.length < 2 ||
              parameters.length === 0
            }
            className="mt-3 w-full rounded-xl bg-[#17496D] px-6 py-4 font-bold text-white disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Input Matrix'}
          </button>

          <button
            onClick={() => saveMatrix(true)}
            disabled={
              saving ||
              products.length < 2 ||
              parameters.length === 0
            }
            className="mt-3 w-full rounded-xl bg-[#4EA3E3] px-6 py-4 font-bold text-white disabled:opacity-50"
          >
            {saving
              ? 'Saving...'
              : 'Save & Continue to Comparison →'}
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

function formatValue(value: number | null) {
  if (value === null) return '—';

  if (Number.isInteger(value)) {
    return value.toString();
  }

  return Number(value.toFixed(4)).toString();
}