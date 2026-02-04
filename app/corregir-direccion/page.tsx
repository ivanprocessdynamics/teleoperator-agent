'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { MapPin, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
}

function AddressForm() {
    const searchParams = useSearchParams();
    const incidentId = searchParams.get('id');

    const [address, setAddress] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

    // Autocomplete State
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const debouncedAddress = useDebounce(address, 500);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Close suggestions when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Fetch suggestions when user types
    useEffect(() => {
        async function fetchSuggestions() {
            if (debouncedAddress.length < 3) {
                setSuggestions([]);
                return;
            }

            try {
                const res = await fetch(`/api/proxy/places-autocomplete?input=${encodeURIComponent(debouncedAddress)}`);
                const data = await res.json();
                if (data.predictions) {
                    setSuggestions(data.predictions);
                    setShowSuggestions(true);
                }
            } catch (e) {
                console.error("Autocomplete error:", e);
            }
        }

        // Only fetch if we are typing (not if we just selected)
        // To distinguish, we could check if current address matches a selected one, 
        // but simple debounce is usually enough if we hide suggestions on select.
        if (status === 'idle') {
            fetchSuggestions();
        }
    }, [debouncedAddress, status]);

    const handleSelect = (suggestion: any) => {
        setAddress(suggestion.description + ", "); // Add comma for appending details
        setSuggestions([]);
        setShowSuggestions(false);
        // Focus back to input
        const input = document.getElementById('address-input');
        if (input) input.focus();
    };

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
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white w-full max-w-md p-8 rounded-2xl shadow-xl text-center border border-green-100">
                    <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                        <CheckCircle2 className="w-8 h-8 text-green-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">¡Dirección Actualizada!</h1>
                    <p className="text-gray-600">Hemos informado al técnico del cambio. Gracias por tu ayuda.</p>
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
                        <p className="text-xs text-gray-500 font-mono bg-gray-100 px-2 py-0.5 rounded inline-block mt-1">
                            Ref: {incidentId?.slice(0, 8)}...
                        </p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2 relative" ref={wrapperRef}>
                        <label className="block text-sm font-semibold text-gray-700">
                            Dirección Completa
                        </label>
                        <p className="text-xs text-gray-500 mb-2">
                            Empieza a escribir y selecciona tu calle. Luego <b>añade el piso y puerta</b>.
                        </p>

                        <input
                            id="address-input"
                            type="text"
                            required
                            placeholder="Ej: Calle Mayor 5..."
                            className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-gray-900 text-lg shadow-sm"
                            value={address}
                            onChange={(e) => {
                                setAddress(e.target.value);
                                setShowSuggestions(true);
                            }}
                            autoComplete="off"
                        />

                        {/* Suggestions Dropdown */}
                        {showSuggestions && suggestions.length > 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl max-h-60 overflow-auto divide-y divide-gray-100">
                                {suggestions.map((suggestion) => (
                                    <button
                                        key={suggestion.place_id}
                                        type="button"
                                        onClick={() => handleSelect(suggestion)}
                                        className="w-full text-left p-3 hover:bg-blue-50 transition flex items-start gap-3 group"
                                    >
                                        <MapPin className="w-4 h-4 text-gray-400 mt-1 group-hover:text-blue-500" />
                                        <span className="text-sm text-gray-700 group-hover:text-gray-900">
                                            {suggestion.description}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

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

                    {status === 'error' && (
                        <div className="p-4 bg-red-50 text-red-600 rounded-xl flex items-center gap-2 text-sm">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            Hubo un error. Por favor inténtalo de nuevo.
                        </div>
                    )}
                </form>
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
