'use client';

import { useState, useEffect } from 'react';
import { Save, Loader2, BookOpen } from 'lucide-react';

export default function KnowledgeBasePage() {
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        fetch('/api/internal/knowledge-base')
            .then(res => res.json())
            .then(data => {
                if (data.content) setContent(data.content);
            })
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, []);

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);
        try {
            const res = await fetch('/api/internal/knowledge-base', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content })
            });
            if (res.ok) {
                setMessage({ type: 'success', text: 'Guardado correctamente. El agente ya tiene la nueva información.' });
            } else {
                setMessage({ type: 'error', text: 'Error al guardar.' });
            }
        } catch (e) {
            setMessage({ type: 'error', text: 'Error de conexión.' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-indigo-50 rounded-xl">
                    <BookOpen className="w-8 h-8 text-indigo-600" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Base de Conocimiento</h1>
                    <p className="text-gray-500">Escribe aquí información sobre horarios, precios, etc. El agente leerá esto para responder dudas.</p>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                </div>
            ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                    <textarea
                        className="w-full h-96 p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none font-mono text-sm leading-relaxed"
                        placeholder="Ej: Abrimos de Lunes a Viernes de 9 a 18h..."
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                    />

                    <div className="mt-4 flex items-center justify-between">
                        <div className="text-sm">
                            {message && (
                                <span className={message.type === 'success' ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                                    {message.text}
                                </span>
                            )}
                        </div>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition flex items-center gap-2 disabled:opacity-70"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Guardar Cambios
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
