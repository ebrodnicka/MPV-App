'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';

type Parameter = {
  id: string;
  name: string;
  unit: string | null;
  indicator_type: string | null;
  weight: number | null;
  sort_order: number | null;
};

type Product = {
  id?: string;
  clientId: string;
  name: string;
};

type ValueMap = Record<string, string>;

export default function InputMatrixPage() {
  const params = useParams();
  const router = useRouter();

  const projectId = params.id as string;

  const [projectName, setProjectName] = useState('');
  const [projectCategory, setProjectCategory] = useState('');

  const [parameters, setParameters] = useState<Parameter[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [originalProductIds, setOriginalProductIds] = useState<string[]>([]);
  const [values, setValues] = useState<ValueMap>({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadPage();
  }, [projectId]);

  function valueKey(productClientId: string, parameterId: string) {
    return `${productClientId}:${parameterId}`;
  }

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

    setParameters(parameterData || []);

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

    const loadedProducts: Product[] = (productData || []).map((product) => ({
      id: product.id,
      clientId: product.id,
      name: product.name || '',
    }));

    setProducts(loadedProducts);

    setOriginalProductIds(
      loadedProducts
        .filter((product) => product.id)
        .map((product) => product.id as string)
    );

    const productIds = loadedProducts
      .filter((product) => product.id)
      .map((product) => product.id as string);

    if (productIds.length === 0) {
      setValues({});
      setLoading(false);
      return;
    }

    const { data: valueData, error: valueError } = await supabase
      .from('product_parameter_values')
      .select('product_id, parameter_id, raw_value')
      .in('product_id', productIds);

    if (valueError) {
      setError(valueError.message);
      setLoading(false);
      return;
    }

    const loadedValues: ValueMap = {};

    (valueData || []).forEach((row) => {
      loadedValues[valueKey(row.product_id, row.parameter_id)] =
        row.raw_value !== null && row.raw_value !== undefined
          ? String(row.raw_value)
          : '';
    });

    setValues(loadedValues);
    setLoading(false);
  }

  function addProduct() {
    setProducts((current) => [
      ...current,
      {
        clientId: `new-${Date.now()}-${Math.random()}`,
        name: '',
      },
    ]);
  }

  function updateProductName(clientId: string, name: string) {
    setProducts((current) =>
      current.map((product) =>
        product.clientId === clientId
          ? {
              ...product,
              name,
            }
          : product
      )
    );
  }

  function updateValue(
    productClientId: string,
    parameterId: string,
    value: string
  ) {
    setValues((current) => ({
      ...current,
      [valueKey(productClientId, parameterId)]: value,
    }));
  }

  function removeProduct(clientId: string) {
    setProducts((current) =>
      current.filter((product) => product.clientId !== clientId)
    );

    setValues((current) => {
      const updated = { ...current };

      Object.keys(updated).forEach((key) => {
        if (key.startsWith(`${clientId}:`)) {
          delete updated[key];
        }
      });

      return updated;
    });
  }

  async function saveMatrix(goNext = false) {
    setError('');
    setMessage('');

    if (parameters.length === 0) {
      setError(
        'No parameters found. Complete Configuration before entering the matrix.'
      );
      return;
    }

    if (products.length === 0) {
      setError('Add at least one product.');
      return;
    }

    const incompleteNames = products.some(
      (product) => !product.name.trim()
    );

    if (incompleteNames) {
      setError('Enter a name for every product.');
      return;
    }

    for (const product of products) {
      for (const parameter of parameters) {
        const rawValue = values[valueKey(product.clientId, parameter.id)];

        if (
          rawValue === undefined ||
          rawValue.trim() === '' ||
          Number.isNaN(Number(rawValue))
        ) {
          setError(
            `Enter a valid value for "${parameter.name}" for product "${product.name}".`
          );
          return;
        }
      }
    }

    setSaving(true);

    try {
      const currentExistingIds = products
        .filter((product) => product.id)
        .map((product) => product.id as string);

      const deletedProductIds = originalProductIds.filter(
        (id) => !currentExistingIds.includes(id)
      );

      if (deletedProductIds.length > 0) {
        const { error: deleteValuesError } = await supabase
          .from('product_parameter_values')
          .delete()
          .in('product_id', deletedProductIds);

        if (deleteValuesError) {
          throw deleteValuesError;
        }

        const { error: deleteProductsError } = await supabase
          .from('products')
          .delete()
          .in('id', deletedProductIds);

        if (deleteProductsError) {
          throw deleteProductsError;
        }
      }

      const savedProducts: {
        clientId: string;
        databaseId: string;
      }[] = [];

      for (let index = 0; index < products.length; index++) {
        const product = products[index];

        if (product.id) {
          const { error: updateError } = await supabase
            .from('products')
            .update({
              name: product.name.trim(),
              sort_order: index + 1,
            })
            .eq('id', product.id)
            .eq('project_id', projectId);

          if (updateError) {
            throw updateError;
          }

          savedProducts.push({
            clientId: product.clientId,
            databaseId: product.id,
          });
        } else {
          const { data: insertedProduct, error: insertError } =
            await supabase
              .from('products')
              .insert({
                project_id: projectId,
                name: product.name.trim(),
                sort_order: index + 1,
              })
              .select('id')
              .single();

          if (insertError || !insertedProduct) {
            throw insertError || new Error('Unable to create product.');
          }

          savedProducts.push({
            clientId: product.clientId,
            databaseId: insertedProduct.id,
          });
        }
      }

      for (const savedProduct of savedProducts) {
        const { error: deleteOldValuesError } = await supabase
          .from('product_parameter_values')
          .delete()
          .eq('product_id', savedProduct.databaseId);

        if (deleteOldValuesError) {
          throw deleteOldValuesError;
        }
      }

      const rowsToInsert: {
        product_id: string;
        parameter_id: string;
        raw_value: number;
      }[] = [];

      savedProducts.forEach((savedProduct) => {
        parameters.forEach((parameter) => {
          rowsToInsert.push({
            product_id: savedProduct.databaseId,
            parameter_id: parameter.id,
            raw_value: Number(
              values[valueKey(savedProduct.clientId, parameter.id)]
            ),
          });
        });
      });

      if (rowsToInsert.length > 0) {
        const { error: valuesInsertError } = await supabase
          .from('product_parameter_values')
          .insert(rowsToInsert);

        if (valuesInsertError) {
          throw valuesInsertError;
        }
      }

      const { error: projectUpdateError } = await supabase
        .from('projects')
        .update({
          current_step: goNext ? 'Comparison' : 'Input Matrix',
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId);

      if (projectUpdateError) {
        throw projectUpdateError;
      }

      if (goNext) {
        router.push(`/project/${projectId}/comparison`);
        return;
      }

      await loadPage();
      setMessage('Input Matrix saved successfully ✅');
    } catch (saveError: any) {
      console.error('INPUT MATRIX SAVE ERROR:', saveError);

      setError(
        saveError?.message ||
          saveError?.details ||
          saveError?.hint ||
          'Input Matrix could not be saved.'
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f8fc]">
        <p className="text-[#60788A]">Loading Input Matrix...</p>
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
              className="flex-1 rounded-xl bg-[#17496D] px-5 py-4 text-center font-bold text-white"
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
              onClick={() =>
                router.push(`/project/${projectId}/results`)
              }
              className="flex-1 rounded-xl px-5 py-4 text-center font-semibold text-[#60788A] hover:bg-[#f4f8fc]"
            >
              4 &nbsp; Results
            </button>
          </div>
        </div>

        <div className="mt-10">
          <p className="text-sm font-bold tracking-[0.3em] text-[#4EA3E3]">
            MODULE 2
          </p>

          <h3 className="mt-3 text-3xl font-bold text-[#153A5B]">
            Input Matrix
          </h3>

          <p className="mt-3 max-w-3xl text-[#60788A]">
            Add products and enter a value for every evaluation parameter.
            These values will be used in the comparison and final MPV
            calculation.
          </p>
        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-[#dbe8f2] bg-white p-5">
            <p className="text-sm text-[#60788A]">Parameters</p>
            <p className="mt-2 text-3xl font-bold text-[#153A5B]">
              {parameters.length}
            </p>
          </div>

          <div className="rounded-2xl border border-[#dbe8f2] bg-white p-5">
            <p className="text-sm text-[#60788A]">Products</p>
            <p className="mt-2 text-3xl font-bold text-[#153A5B]">
              {products.length}
            </p>
          </div>
        </div>

        {parameters.length === 0 ? (
          <div className="mt-7 rounded-2xl border border-red-200 bg-red-50 p-6">
            <p className="font-semibold text-red-700">
              No parameters found.
            </p>
            <p className="mt-2 text-sm text-red-600">
              Return to Configuration and add at least one parameter.
            </p>
          </div>
        ) : (
          <>
            <button
              onClick={addProduct}
              className="mt-7 w-full rounded-xl bg-[#17496D] px-6 py-4 font-bold text-white"
            >
              + Add Product
            </button>

            <div className="mt-7 overflow-x-auto rounded-3xl border border-[#dbe8f2] bg-white shadow-sm">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="border-b border-[#dbe8f2] bg-[#f8fbfd]">
                    <th className="min-w-[220px] px-5 py-4 text-left text-sm font-bold text-[#153A5B]">
                      Product
                    </th>

                    {parameters.map((parameter) => (
                      <th
                        key={parameter.id}
                        className="min-w-[180px] px-5 py-4 text-left"
                      >
                        <p className="text-sm font-bold text-[#153A5B]">
                          {parameter.name}
                        </p>

                        <p className="mt-1 text-xs text-[#60788A]">
                          {parameter.unit || 'No unit'}
                        </p>

                        <p className="mt-1 text-xs text-[#4EA3E3]">
                          Weight {parameter.weight || 0}/10
                        </p>

                        <p className="mt-1 text-xs text-[#8AA0B0]">
                          {parameter.indicator_type === 'destimulant'
                            ? '↓ Less is better'
                            : '↑ More is better'}
                        </p>
                      </th>
                    ))}

                    <th className="w-[100px] px-5 py-4"></th>
                  </tr>
                </thead>

                <tbody>
                  {products.map((product) => (
                    <tr
                      key={product.clientId}
                      className="border-b border-[#edf3f7] last:border-b-0"
                    >
                      <td className="px-5 py-4">
                        <input
                          value={product.name}
                          onChange={(event) =>
                            updateProductName(
                              product.clientId,
                              event.target.value
                            )
                          }
                          placeholder="Product name"
                          className="w-full rounded-xl border border-[#cbdde9] px-4 py-3 text-[#153A5B] outline-none"
                        />
                      </td>

                      {parameters.map((parameter) => (
                        <td key={parameter.id} className="px-5 py-4">
                          <input
                            type="number"
                            step="any"
                            value={
                              values[
                                valueKey(product.clientId, parameter.id)
                              ] ?? ''
                            }
                            onChange={(event) =>
                              updateValue(
                                product.clientId,
                                parameter.id,
                                event.target.value
                              )
                            }
                            placeholder="0"
                            className="w-full rounded-xl border border-[#cbdde9] px-4 py-3 text-[#153A5B] outline-none"
                          />
                        </td>
                      ))}

                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() =>
                            removeProduct(product.clientId)
                          }
                          className="rounded-lg px-3 py-2 text-sm font-semibold text-red-600"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}

                  {products.length === 0 && (
                    <tr>
                      <td
                        colSpan={parameters.length + 2}
                        className="px-6 py-12 text-center"
                      >
                        <p className="font-semibold text-[#153A5B]">
                          No products added yet
                        </p>

                        <p className="mt-2 text-sm text-[#60788A]">
                          Click “Add Product” to create the first row.
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
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
            onClick={() =>
              router.push(`/project/${projectId}/configuration`)
            }
            className="w-full rounded-xl border border-[#cbdde9] px-6 py-4 font-semibold text-[#153A5B]"
          >
            ← Back to Configuration
          </button>

          <button
            onClick={() => saveMatrix(false)}
            disabled={saving || parameters.length === 0}
            className="mt-3 w-full rounded-xl bg-[#17496D] px-6 py-4 font-bold text-white disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Input Matrix'}
          </button>

          <button
            onClick={() => saveMatrix(true)}
            disabled={saving || parameters.length === 0}
            className="mt-3 w-full rounded-xl bg-[#4EA3E3] px-6 py-4 font-bold text-white disabled:opacity-50"
          >
            {saving
              ? 'Saving...'
              : 'Save & Continue to Comparison →'}
          </button>
        </div>
      </section>
    </main>
  );
}