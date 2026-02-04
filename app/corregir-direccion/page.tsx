'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { MapPin, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

function AddressForm() {
    const searchParams = useSearchParams();
    const incidentId = searchParams.get('id');

    // Granular State - Manual Entry Only
    const [street, setStreet] = useState('');
    const [number, setNumber] = useState('');
    const [floor, setFloor] = useState('');
    const [postalCode, setPostalCode] = useState('');
    const [city, setCity] = useState('');
    const [province, setProvince] = useState('');

    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!incidentId) return;

        // Construct full address string
        const fullAddress = `${street}, ${number}, ${floor ? `Piso ${floor},` : ''} ${postalCode} ${city}, ${province} (España)`;

        setStatus('loading');

        try {
            const res = await fetch('/api/web/update-address', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ incidentId, address: fullAddress }),
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
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white w-full max-w-md p-8 rounded-2xl shadow-xl text-center border border-green-100">
                    <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                        <CheckCircle2 className="w-8 h-8 text-green-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">¡Dirección Guardada!</h1>
                    <p className="text-gray-600">Hemos actualizado la información de tu visita.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-10 px-4 flex justify-center items-start sm:items-center">
            <div className="bg-white w-full max-w-md p-6 sm:p-8 rounded-2xl shadow-xl border border-gray-100">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-blue-50 rounded-xl">
                        <MapPin className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">Corregir Dirección</h1>
                        <p className="text-sm text-gray-500">
                            Introduce los datos manualmente
                        </p>
                    </div>
                </div>

                <div className="space-y-6">
                    {status === 'error' && (
                        <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" />
                            Hubo un error al guardar. Inténtalo de nuevo.
                        </div>
                    )}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Street */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Calle / Avenida</label>
                            <input
                                required
                                value={street}
                                onChange={(e) => setStreet(e.target.value)}
                                className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="Nombre de la calle"
                            />
                        </div>

                        {/* Num & Floor */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Número</label>
                                <input
                                    required
                                    value={number}
                                    onChange={(e) => setNumber(e.target.value)}
                                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="Nº"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Piso / Puerta</label>
                                <input
                                    value={floor}
                                    onChange={(e) => setFloor(e.target.value)}
                                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="Ej: 3º 1ª"
                                />
                            </div>
                        </div>

                        {/* CP & City */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="col-span-1">
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">CP</label>
                                <input
                                    required
                                    value={postalCode}
                                    onChange={(e) => setPostalCode(e.target.value)}
                                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="CP"
                                />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Población</label>
                                <input
                                    required
                                    value={city}
                                    onChange={(e) => setCity(e.target.value)}
                                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="Ciudad"
                                />
                            </div>
                        </div>

                        {/* Province */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Provincia</label>
                            <input
                                required
                                value={province}
                                onChange={(e) => setProvince(e.target.value)}
                                className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="Provincia"
                            />
                        </div>

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={status === 'loading'}
                                className="w-full bg-slate-900 text-white py-4 rounded-xl font-semibold text-lg hover:bg-slate-800 transition disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-slate-900/20"
                            >
                                {status === 'loading' ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Guardando...
                                    </>
                                ) : (
                                    'Confirmar Dirección'
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default function Page() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center text-gray-500">
                <Loader2 className="w-8 h-8 animate-spin" />
            </div>
        }>
            <AddressForm />
        </Suspense>
    );
}
