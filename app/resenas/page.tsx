'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, AlertCircle, ShieldCheck, Send, Lock, Star, MessageSquare } from 'lucide-react';

// ─── Step 1: OTP Verification ─────────────────────────
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

    if (step === 'locked') return (
        <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <Lock className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Sesión Bloqueada</h2>
            <p className="text-gray-600 text-sm">Se ha superado el número máximo de intentos.</p>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-50 rounded-xl">
                    <ShieldCheck className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-gray-900">Validación</h1>
                    <p className="text-sm text-gray-500">
                        {step === 'initial' ? 'Verifica tu identidad antes de dejar una reseña.' : `Código enviado a ${phoneMask}`}
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
                <button
                    onClick={handleSendOTP}
                    disabled={loading}
                    className="w-full bg-indigo-600 text-white py-4 rounded-xl font-semibold text-lg hover:bg-indigo-700 transition"
                >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Enviar Código SMS'}
                </button>
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
                                disabled={loading}
                                className="w-12 h-14 text-center text-2xl font-bold border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 outline-none transition"
                            />
                        ))}
                    </div>
                    {loading && <div className="flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>}
                </div>
            )}
        </div>
    );
}

// ─── Step 2: Rating Form ────────────────────────────────────────────────────
function RatingGroup({ label, value, onChange }: { label: string, value: number, onChange: (v: number) => void }) {
    return (
        <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>
            <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                    <button
                        key={star}
                        type="button"
                        onClick={() => onChange(star)}
                        className="p-1 focus:outline-none transition-transform hover:scale-110"
                    >
                        <Star className={`w-8 h-8 ${star <= value ? 'fill-yellow-400 text-yellow-500' : 'fill-gray-100 text-gray-300'}`} />
                    </button>
                ))}
            </div>
        </div>
    );
}

function FeedbackFormStep({ incidentId, token }: { incidentId: string; token: string; }) {
    const [scorePunctuality, setScorePunctuality] = useState(0);
    const [scoreTreatment, setScoreTreatment] = useState(0);
    const [scoreResolution, setScoreResolution] = useState(0);
    const [comments, setComments] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!scorePunctuality || !scoreTreatment || !scoreResolution) {
             setStatus('error');
             return;
        }

        setStatus('loading');
        try {
            const res = await fetch('/api/web/submit-feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    incidentId,
                    token,
                    scorePunctuality,
                    scoreTreatment,
                    scoreResolution,
                    comments
                }),
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
                <div className="mx-auto w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center">
                    <Star className="w-10 h-10 text-indigo-600 fill-indigo-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">¡Gracias por tu reseña!</h1>
                <p className="text-gray-600 text-sm">
                    Tus comentarios nos ayudan a mejorar continuamente nuestro servicio.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="p-3 bg-yellow-50 rounded-xl">
                    <Star className="w-6 h-6 text-yellow-600 fill-yellow-600" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-gray-900">Reseña del Servicio</h1>
                    <p className="text-sm text-gray-500">Valora tu experiencia reciente de 1 a 5 estrellas.</p>
                </div>
            </div>

            {status === 'error' && (
                <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    Asegúrate de valorar las tres opciones antes de enviar e inténtalo de nuevo.
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                 
                <div className="bg-gray-50 p-5 rounded-2xl space-y-5 border border-gray-100">
                    <RatingGroup label="¿Qué nivel de puntualidad tuvimos?" value={scorePunctuality} onChange={setScorePunctuality} />
                    <RatingGroup label="¿Qué tal fue el trato recibido?" value={scoreTreatment} onChange={setScoreTreatment} />
                    <RatingGroup label="¿Cómo calificarías la resolución técnica?" value={scoreResolution} onChange={setScoreResolution} />
                </div>

                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" /> Comentarios Adicionales (Opcional)
                    </label>
                    <textarea value={comments} onChange={e => setComments(e.target.value)} rows={4}
                        className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition resize-none"
                        placeholder="Escribe tu opinión detallada aquí..." />
                </div>

                <button
                    type="submit"
                    disabled={status === 'loading'}
                    className="w-full bg-slate-900 text-white py-4 rounded-xl font-semibold text-lg hover:bg-slate-800 transition disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-slate-900/20"
                >
                    {status === 'loading' ? (
                        <><Loader2 className="w-5 h-5 animate-spin" /> Procesando...</>
                    ) : (
                        'Publicar Reseña'
                    )}
                </button>
            </form>
        </div>
    );
}

// ─── Main Controller ────────────────────────────────────────────────────────
export default function Page() {
    return (
        <Suspense fallback={<div className="min-h-screen flex text-gray-500 justify-center items-center"><Loader2 className="w-8 h-8 animate-spin" /></div>}>
            <FeedbackController />
        </Suspense>
    );
}

function FeedbackController() {
    const searchParams = useSearchParams();
    const incidentId = searchParams.get('id');
    const [verifiedToken, setVerifiedToken] = useState<string | null>(null);

    if (!incidentId) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl text-center border">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h1 className="text-xl font-bold text-gray-900">Enlace Inválido</h1>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-10 px-4 flex justify-center items-start sm:items-center">
            <div className="bg-white w-full max-w-md p-6 sm:p-8 rounded-2xl shadow-xl border border-gray-100">
                {verifiedToken ? (
                    <FeedbackFormStep incidentId={incidentId} token={verifiedToken} />
                ) : (
                    <OTPStep incidentId={incidentId} onVerified={setVerifiedToken} />
                )}
            </div>
        </div>
    );
}
