'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, AlertCircle, ShieldCheck, Send, Lock, PenTool } from 'lucide-react';

// ─── Step 1: OTP Verification (Re-Used UI Style) ─────────────────────────
function OTPStep({
    incidentId,
    onVerified
}: {
    incidentId: string;
    onVerified: (token: string, phone: string) => void;
}) {
    const [step, setStep] = useState<'initial' | 'code_sent' | 'locked'>('initial');
    const [phoneMask, setPhoneMask] = useState('');
    const [rawPhone, setRawPhone] = useState(''); // To prefill the next step
    const [code, setCode] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [countdown, setCountdown] = useState(0);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => {
        if (countdown <= 0) return;
        const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [countdown]);

    // Fetch raw phone first so we have it for the form
    useEffect(() => {
        fetch('/api/web/get-lead', {
            method: 'POST',
            body: JSON.stringify({ incidentId }),
            headers: { 'Content-Type': 'application/json' }
        }).then(res => res.json()).then(data => {
            if (data.success && data.phone) {
                setRawPhone(data.phone);
            }
        }).catch(() => {});
    }, [incidentId]);


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
        const digit = value.replace(/\D/g, '').slice(-1);
        const newCode = [...code];
        newCode[index] = digit;
        setCode(newCode);

        if (digit && index < 5) inputRefs.current[index + 1]?.focus();

        if (digit && index === 5) {
            const fullCode = newCode.join('');
            if (fullCode.length === 6) handleVerify(fullCode);
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
                onVerified(data.token, rawPhone);
            } else if (res.status === 429) {
                setStep('locked');
                setError(data.error);
            } else if (res.status === 410) {
                setError(data.error);
                setStep('initial');
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
                <div className="p-3 bg-rose-50 rounded-xl">
                    <ShieldCheck className="w-6 h-6 text-rose-600" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-gray-900">Seguridad</h1>
                    <p className="text-sm text-gray-500">
                        {step === 'initial'
                            ? 'Confirma tu identidad para reportar la avería'
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
                        Enviaremos un código de verificación por SMS para certificar que eres tú antes de rellenar los datos.
                    </p>
                    <button
                        onClick={handleSendOTP}
                        disabled={loading}
                        className="w-full bg-rose-600 text-white py-4 rounded-xl font-semibold text-lg hover:bg-rose-700 transition disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-rose-600/20"
                    >
                        {loading ? (
                            <><Loader2 className="w-5 h-5 animate-spin" /> Enviando...</>
                        ) : (
                            <><Send className="w-5 h-5" /> Enviar Código</>
                        )}
                    </button>
                </div>
            ) : (
                <div className="space-y-5">
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
                                className="w-12 h-14 text-center text-2xl font-bold border-2 border-gray-200 rounded-xl focus:border-rose-500 focus:ring-2 focus:ring-rose-200 outline-none transition disabled:opacity-50"
                            />
                        ))}
                    </div>

                    {loading && (
                        <div className="flex justify-center">
                            <Loader2 className="w-6 h-6 animate-spin text-rose-600" />
                        </div>
                    )}

                    <div className="text-center">
                        {countdown > 0 ? (
                            <p className="text-sm text-gray-400">Reenviar código en {countdown}s</p>
                        ) : (
                            <button
                                onClick={handleSendOTP}
                                disabled={loading}
                                className="text-sm text-rose-600 hover:text-rose-800 font-medium disabled:opacity-50"
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

// ─── Step 2: Form ───────────────────────────────────────────────────────────
function IncidentFormStep({
    incidentId,
    token,
    prefilledPhone
}: {
    incidentId: string;
    token: string;
    prefilledPhone: string;
}) {
    const [clientName, setClientName] = useState('');
    const [address, setAddress] = useState('');
    const [scheduledDateTime, setScheduledDateTime] = useState('');
    const [issueDetails, setIssueDetails] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus('loading');

        try {
            const payload = {
                incidentId,
                token,
                clientName,
                address,
                scheduledDateTime,
                issueDetails,
                phone: prefilledPhone
            };

            const res = await fetch('/api/web/submit-incident', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
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
            <div className="text-center space-y-5 py-4">
                <div className="mx-auto w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center">
                    <ShieldCheck className="w-10 h-10 text-emerald-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">¡Avería Reportada!</h1>
                <p className="text-gray-600 text-sm">
                    Hemos registrado los detalles correctamente. Nuestro equipo técnico se pondrá en contacto pronto o acudirá a la cita programada.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-50 rounded-xl">
                    <PenTool className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-gray-900">Reporte de Avería</h1>
                    <p className="text-sm text-gray-500">Completa los detalles para agilizar el proceso.</p>
                </div>
            </div>

            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg text-xs flex items-center gap-2 font-medium">
                <ShieldCheck className="w-4 h-4" />
                Identidad verificada
            </div>

            {status === 'error' && (
                <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Hubo un problema al enviar el reporte. Por favor, revisa tu conexión e inténtalo de nuevo.
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Locked Phone Field */}
                <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Teléfono (Contacto)</label>
                    <div className="w-full p-3 bg-gray-100 border border-gray-200 text-gray-500 rounded-lg font-medium cursor-not-allowed">
                        {prefilledPhone || "Cargando teléfono..."}
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Nombre y Apellidos *</label>
                    <input required value={clientName} onChange={e => setClientName(e.target.value)}
                        className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition"
                        placeholder="Ej: Juan Pérez" />
                </div>

                <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Dirección Completa *</label>
                    <input required value={address} onChange={e => setAddress(e.target.value)}
                        className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition"
                        placeholder="Ej: Calle Principal 123, Piso 1" />
                </div>

                <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Disponibilidad (Fecha y Hora)</label>
                    <input type="datetime-local" value={scheduledDateTime} onChange={e => setScheduledDateTime(e.target.value)}
                        className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition text-gray-800" />
                </div>

                <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Detalles de la Avería *</label>
                    <textarea required value={issueDetails} onChange={e => setIssueDetails(e.target.value)} rows={4}
                        className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition resize-none"
                        placeholder="Describe puntualmente el problema técnico..." />
                </div>

                <div className="pt-2">
                    <button
                        type="submit"
                        disabled={status === 'loading'}
                        className="w-full bg-slate-900 text-white py-4 rounded-xl font-semibold text-lg hover:bg-slate-800 transition disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-slate-900/20"
                    >
                        {status === 'loading' ? (
                            <><Loader2 className="w-5 h-5 animate-spin" /> Registrando...</>
                        ) : (
                            'Enviar Reporte'
                        )}
                    </button>
                    <p className="text-center text-xs text-gray-400 font-medium mt-3">Tus datos están protegidos.</p>
                </div>
            </form>
        </div>
    );
}

// ─── Main Controller ────────────────────────────────────────────────────────
function SubmitIncidentController() {
    const searchParams = useSearchParams();
    const incidentId = searchParams.get('id');
    const [verifiedState, setVerifiedState] = useState<{ token: string, phone: string } | null>(null);

    if (!incidentId) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white w-full max-w-md p-8 rounded-2xl shadow-xl text-center border border-red-100">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h1 className="text-xl font-bold text-gray-900 mb-2">Enlace Inválido</h1>
                    <p className="text-gray-600 text-sm">El acceso a este formulario no es válido o ha caducado.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-10 px-4 flex justify-center items-start sm:items-center">
            <div className="bg-white w-full max-w-md p-6 sm:p-8 rounded-2xl shadow-xl border border-gray-100">
                {verifiedState ? (
                    <IncidentFormStep
                        incidentId={incidentId}
                        token={verifiedState.token}
                        prefilledPhone={verifiedState.phone}
                    />
                ) : (
                    <OTPStep
                        incidentId={incidentId}
                        onVerified={(token, phone) => setVerifiedState({ token, phone })}
                    />
                )}
            </div>
        </div>
    );
}

export default function Page() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">
                <Loader2 className="w-8 h-8 animate-spin" />
            </div>
        }>
            <SubmitIncidentController />
        </Suspense>
    );
}
