'use client';

import { useEffect, useState } from 'react';
import supabase from '@/lib/supabase';

export default function TestConnectionPage() {
  const [status, setStatus] = useState('Testing connection...');

  useEffect(() => {
    async function testConnection() {
      try {
        const { error } = await supabase
          .from('projects')
          .select('id')
          .limit(1);

        if (error) {
          setStatus(`Connection error: ${error.message}`);
          return;
        }

        setStatus('Supabase connection successful ✅');
      } catch (error: any) {
        setStatus(`Connection error: ${error.message}`);
      }
    }

    testConnection();
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f8fc] p-6">
      <div className="w-full max-w-lg rounded-3xl bg-white p-10 text-center shadow-lg">
        <p className="text-sm font-bold tracking-[0.3em] text-[#4EA3E3]">
          MPV
        </p>

        <h1 className="mt-4 text-3xl font-bold text-[#153A5B]">
          Database Connection Test
        </h1>

        <p className="mt-6 text-[#60788A]">{status}</p>
      </div>
    </main>
  );
}