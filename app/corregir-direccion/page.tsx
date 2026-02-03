'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function AddressForm() {
    const searchParams = useSearchParams();
    const incidentId = searchParams.get('id'); // Leemos el ID de la URL
    const [address, setAddress] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!incidentId || !address) return;

        setStatus('loading');

        try {
            const res = await fetch('/api/web/update-address', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ incidentId, address }),
            });

            if (res.ok) {
                setStatus('success');
            } else {
                setStatus('error');
            }
        } catch (err) {
            setStatus('error');
        }
    };

    if (status === 'success') {
        return (
            <div className="p-8 text-center max-w-md mx-auto mt-10 bg-green-50 rounded-lg border border-green-200">
                <h1 className="text-2xl font-bold text-green-700 mb-2">¡Dirección Actualizada!</h1>
                <p className="text-green-800">Hemos informado al técnico del cambio. Gracias.</p>
            </div>
        );
    }

    return (
        <div className="max-w-md mx-auto mt-10 p-6 bg-white shadow-lg rounded-lg border border-gray-100">
            <h1 className="text-xl font-bold mb-4 text-gray-800">Corregir Dirección de Visita</h1>
            <p className="text-sm text-gray-500 mb-6">
                Referencia de la incidencia: <span className="font-mono bg-gray-100 px-1 rounded">{incidentId}</span>
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nueva Dirección Completa</label>
                    <input
                        type="text"
                        required
                        placeholder="Ej: Calle Mayor 5, 2º A, Tarragona"
                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none transition"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                    />
                </div>

                <button
                    type="submit"
                    disabled={status === 'loading'}
                    className="w-full bg-black text-white py-3 rounded-md font-medium hover:bg-gray-800 transition disabled:opacity-50"
                >
                    {status === 'loading' ? 'Guardando...' : 'Confirmar Dirección'}
                </button>

                {status === 'error' && (
                    <p className="text-red-500 text-sm text-center">Hubo un error. Por favor inténtalo de nuevo.</p>
                )}
            </form>
        </div>
    );
}

export default function Page() {
    return (
        <Suspense fallback={<div>Cargando...</div>}>
            <AddressForm />
        </Suspense>
    );
}
