'use client';

import Link from 'next/link';
import { LogIn } from './ui-icons';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">TaskPulse</h1>
        <p className="text-lg text-gray-600">Le travail, en mouvement.</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-4">
        <Link
          href="/login"
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2"
        >
          <LogIn size={18} /> Se connecter
        </Link>
        <Link
          href="/register-org"
          className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-100 transition"
        >
          Créer une organisation
        </Link>
      </div>
    </main>
  );
}