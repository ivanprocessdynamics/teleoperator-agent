'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { MapPin, Loader2, CheckCircle2, AlertCircle, ShieldCheck, Send, Lock } from 'lucide-react';

// ─── Step 1: OTP Verification ───────────────────────────────────────────────
function OTPStep({
    incidentId,
    onVerified
}: {
    incidentId: string;
    onVerified: (token: string) => void;
}) {
    const [step, setStep] = useState<'initial' | 'code_sent' | 'locked'>('initial');
    const [phoneMask, setPhoneMask] = useState('');
    const [code, setCode] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [countdown, setCountdown] = useState(0);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    // Countdown timer for resend
    useEffect(() => {
        if (countdown <= 0) return;
        const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [countdown]);

    const handleSendOTP = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/web/send-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ incidentId }),
            });
            const data = await res.json();

            if (res.ok) {
                setPhoneMask(data.phoneMask);
                setStep('code_sent');
                setCountdown(60);
                setCode(['', '', '', '', '', '']);
                // Focus first input
                setTimeout(() => inputRefs.current[0]?.focus(), 100);
            } else if (res.status === 429) {
                setStep('locked');
                setError(data.error);
            } else {
                setError(data.error || 'Error al enviar el código');
            }
        } catch (e) {
            setError('Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    const handleCodeChange = (index: number, value: string) => {
        // Only accept digits
        const digit = value.replace(/\D/g, '').slice(-1);
        const newCode = [...code];
        newCode[index] = digit;
        setCode(newCode);

        // Auto-advance to next input
        if (digit && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }

        // Auto-submit when all 6 digits are entered
        if (digit && index === 5) {
            const fullCode = newCode.join('');
            if (fullCode.length === 6) {
                handleVerify(fullCode);
            }
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !code[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (pasted.length === 6) {
            const newCode = pasted.split('');
            setCode(newCode);
            handleVerify(pasted);
        }
    };

    const handleVerify = async (codeStr: string) => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/web/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ incidentId, code: codeStr }),
            });
            const data = await res.json();

            if (res.ok && data.verified) {
                onVerified(data.token);
            } else if (res.status === 429) {
                setStep('locked');
                setError(data.error);
            } else if (res.status === 410) {
                setError(data.error);
                setStep('initial'); // Allow requesting new code
            } else {
                setError(data.error || 'Código incorrecto');
                setCode(['', '', '', '', '', '']);
                setTimeout(() => inputRefs.current[0]?.focus(), 100);
            }
        } catch (e) {
            setError('Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    // Locked state
    if (step === 'locked') {
        return (
            <div className="text-center space-y-4">
                <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                    <Lock className="w-8 h-8 text-red-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Sesión Bloqueada</h2>
                <p className="text-gray-600 text-sm">
                    Se ha superado el número máximo de intentos. Por seguridad, esta sesión ha sido bloqueada.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-50 rounded-xl">
                    <ShieldCheck className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-gray-900">Verificación</h1>
                    <p className="text-sm text-gray-500">
                        {step === 'initial'
                            ? 'Confirma tu identidad para acceder al formulario'
                            : `Código enviado a ${phoneMask}`
                        }
                    </p>
                </div>
            </div>

            {error && (
                <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                </div>
            )}

            {step === 'initial' ? (
                <div className="space-y-4">
                    <p className="text-gray-600 text-sm">
                        Enviaremos un código de verificación al número de teléfono asociado a esta incidencia.
                    </p>
                    <button
                        onClick={handleSendOTP}
                        disabled={loading}
                        className="w-full bg-indigo-600 text-white py-4 rounded-xl font-semibold text-lg hover:bg-indigo-700 transition disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Enviando...
                            </>
                        ) : (
                            <>
                                <Send className="w-5 h-5" />
                                Enviar Código
                            </>
                        )}
                    </button>
                </div>
            ) : (
                <div className="space-y-5">
                    {/* 6-digit input */}
                    <div className="flex justify-center gap-2">
                        {code.map((digit, i) => (
                            <input
                                key={i}
                                ref={el => { inputRefs.current[i] = el; }}
                                type="text"
                                inputMode="numeric"
                                maxLength={1}
                                value={digit}
                                onChange={e => handleCodeChange(i, e.target.value)}
                                onKeyDown={e => handleKeyDown(i, e)}
                                onPaste={i === 0 ? handlePaste : undefined}
                                disabled={loading}
                                className="w-12 h-14 text-center text-2xl font-bold border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition disabled:opacity-50"
                            />
                        ))}
                    </div>

                    {loading && (
                        <div className="flex justify-center">
                            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                        </div>
                    )}

                    {/* Resend */}
                    <div className="text-center">
                        {countdown > 0 ? (
                            <p className="text-sm text-gray-400">
                                Reenviar código en {countdown}s
                            </p>
                        ) : (
                            <button
                                onClick={handleSendOTP}
                                disabled={loading}
                                className="text-sm text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-50"
                            >
                                Reenviar código
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Step 2: Address Form (existing, now receives token) ────────────────────
function AddressFormStep({
    incidentId,
    token
}: {
    incidentId: string;
    token: string;
}) {
    const [street, setStreet] = useState('');
    const [number, setNumber] = useState('');
    const [floor, setFloor] = useState('');
    const [postalCode, setPostalCode] = useState('');
    const [city, setCity] = useState('');
    const [province, setProvince] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const fullAddress = `${street}, ${number}, ${floor ? `Piso ${floor},` : ''} ${postalCode} ${city}, ${province} (España)`;
        setStatus('loading');

        try {
            const res = await fetch('/api/web/update-address', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ incidentId, address: fullAddress, token }),
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
            <div className="text-center space-y-4">
                <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">¡Dirección Guardada!</h1>
                <p className="text-gray-600">Hemos actualizado la información de tu visita.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-50 rounded-xl">
                    <MapPin className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-gray-900">Corregir Dirección</h1>
                    <p className="text-sm text-gray-500">Introduce los datos manualmente</p>
                </div>
            </div>

            {/* Verified badge */}
            <div className="p-2 bg-green-50 text-green-700 rounded-lg text-xs flex items-center gap-2 font-medium">
                <ShieldCheck className="w-4 h-4" />
                Identidad verificada
            </div>

            {status === 'error' && (
                <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Hubo un error al guardar. Inténtalo de nuevo.
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Calle / Avenida</label>
                    <input required value={street} onChange={e => setStreet(e.target.value)}
                        className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Nombre de la calle" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Número</label>
                        <input required value={number} onChange={e => setNumber(e.target.value)}
                            className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Nº" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Piso / Puerta</label>
                        <input value={floor} onChange={e => setFloor(e.target.value)}
                            className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Ej: 3º 1ª" />
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-1">
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">CP</label>
                        <input required value={postalCode} onChange={e => setPostalCode(e.target.value)}
                            className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="CP" />
                    </div>
                    <div className="col-span-2">
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Población</label>
                        <input required value={city} onChange={e => setCity(e.target.value)}
                            className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Ciudad" />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Provincia</label>
                    <input required value={province} onChange={e => setProvince(e.target.value)}
                        className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Provincia" />
                </div>

                <div className="pt-2">
                    <button
                        type="submit"
                        disabled={status === 'loading'}
                        className="w-full bg-slate-900 text-white py-4 rounded-xl font-semibold text-lg hover:bg-slate-800 transition disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-slate-900/20"
                    >
                        {status === 'loading' ? (
                            <><Loader2 className="w-5 h-5 animate-spin" /> Guardando...</>
                        ) : (
                            'Confirmar Dirección'
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}

// ─── Main Component ─────────────────────────────────────────────────────────
function AddressVerification() {
    const searchParams = useSearchParams();
    const incidentId = searchParams.get('id');
    const [verifiedToken, setVerifiedToken] = useState<string | null>(null);

    if (!incidentId) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white w-full max-w-md p-8 rounded-2xl shadow-xl text-center border border-red-100">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h1 className="text-xl font-bold text-gray-900 mb-2">Enlace Inválido</h1>
                    <p className="text-gray-600 text-sm">Este enlace no contiene un ID de incidencia válido.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-10 px-4 flex justify-center items-start sm:items-center">
            <div className="bg-white w-full max-w-md p-6 sm:p-8 rounded-2xl shadow-xl border border-gray-100">
                {verifiedToken ? (
                    <AddressFormStep incidentId={incidentId} token={verifiedToken} />
                ) : (
                    <OTPStep incidentId={incidentId} onVerified={setVerifiedToken} />
                )}
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
            <AddressVerification />
        </Suspense>
    );
}
