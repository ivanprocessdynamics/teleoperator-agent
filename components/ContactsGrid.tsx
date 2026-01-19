"use client";

import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Play, Plus, Upload, Phone, AlertCircle, Users, ArrowLeft, Save, Table as TableIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Contact {
    id: string;
    name: string;
    phone: string;
    custom_data?: string; // JSON string for simplicity in UI
    status: 'not_called' | 'calling' | 'on_call' | 'answered' | 'no_answer';
}

interface ManualRow {
    id: string; // temp id
    name: string;
    phone: string;
}

interface ContactsGridProps {
    subworkspaceId: string;
}

export function ContactsGrid({ subworkspaceId }: ContactsGridProps) {
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loading, setLoading] = useState(true);

    // Manual Entry Mode State
    const [isManualEntryMode, setIsManualEntryMode] = useState(false);
    const [manualRows, setManualRows] = useState<ManualRow[]>([]);

    useEffect(() => {
        if (!subworkspaceId) return;

        // Real-time listener for contacts
        const q = query(
            collection(db, "contacts"),
            where("subworkspace_id", "==", subworkspaceId)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetched: Contact[] = [];
            snapshot.forEach((doc) => {
                fetched.push({ id: doc.id, ...doc.data() } as Contact);
            });
            setContacts(fetched);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [subworkspaceId]);

    // Initialize manual rows
    useEffect(() => {
        if (isManualEntryMode && manualRows.length === 0) {
            // Create 10 empty rows
            const initialRows = Array.from({ length: 10 }).map((_, i) => ({
                id: `temp-${Date.now()}-${i}`,
                name: "",
                phone: ""
            }));
            setManualRows(initialRows);
        }
    }, [isManualEntryMode]);

    const handleManualRowChange = (id: string, field: 'name' | 'phone', value: string) => {
        setManualRows(prev => prev.map(row =>
            row.id === id ? { ...row, [field]: value } : row
        ));
    };

    const handleAddManualRow = () => {
        setManualRows(prev => [
            ...prev,
            { id: `temp-${Date.now()}`, name: "", phone: "" }
        ]);
    };

    const saveManualContacts = async (shouldLaunch: boolean = false) => {
        const validRows = manualRows.filter(r => r.name.trim() || r.phone.trim());
        if (validRows.length === 0) {
            setIsManualEntryMode(false);
            return;
        }

        try {
            // Batch create would be ideal, but simple loop for MVP
            const promises = validRows.map(row => {
                return addDoc(collection(db, "contacts"), {
                    subworkspace_id: subworkspaceId,
                    name: row.name,
                    phone: row.phone,
                    status: shouldLaunch ? 'calling' : 'not_called', // If launching immediately, maybe logic differs, but simple for now
                    created_at: serverTimestamp(),
                    custom_data: '{}'
                });
            });

            await Promise.all(promises);

            // Allow state to clear
            setManualRows([]);
            setIsManualEntryMode(false);

            if (shouldLaunch) {
                // Here we would actually trigger the API or logic
                alert("Campaña lanzada para los nuevos contactos!");
                // Note: Launching effectively means setting them to 'calling' or queuing them
            }
        } catch (e) {
            console.error("Error saving manual contacts", e);
            alert("Error al guardar contactos.");
        }
    };

    const getStatusColor = (status: Contact['status']) => {
        switch (status) {
            case 'answered': return 'bg-green-100 text-green-700 border-green-200';
            case 'no_answer': return 'bg-purple-100 text-purple-700 border-purple-200';
            case 'calling':
            case 'on_call': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                        {isManualEntryMode ? "Añadir Contactos Manualmente" : "Lista de Contactos"}
                    </h2>
                    <p className="text-sm text-gray-500">
                        {isManualEntryMode ? "Rellena la tabla tipo Excel y guarda." : "Gestiona los clientes potenciales para este agente."}
                    </p>
                </div>

                {!isManualEntryMode && (
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="bg-white hover:bg-gray-50 text-gray-700 border-gray-200">
                            <Upload className="mr-2 h-4 w-4" /> Importar CSV
                        </Button>
                        <Button
                            size="sm"
                            onClick={() => setIsManualEntryMode(true)}
                            className="bg-gray-900 hover:bg-black text-white shadow-sm transition-all hover:scale-105"
                        >
                            <TableIcon className="mr-2 h-4 w-4" /> Añadir Manualmente
                        </Button>
                    </div>
                )}

                {isManualEntryMode && (
                    <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setIsManualEntryMode(false)} className="text-gray-900 hover:bg-gray-100 font-medium">
                            Cancelar
                        </Button>
                    </div>
                )}
            </div>

            <div className="rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm">

                {/* MANUAL ENTRY TABLE */}
                {isManualEntryMode ? (
                    <div className="flex flex-col">
                        <div className="overflow-x-auto max-h-[500px]">
                            <table className="w-full text-sm border-collapse">
                                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-900 uppercase tracking-wider border-r border-gray-200 w-1/2">Nombre</th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-900 uppercase tracking-wider w-1/2">Teléfono</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-100">
                                    {manualRows.map((row) => (
                                        <tr key={row.id} className="hover:bg-gray-50/50">
                                            <td className="p-0 border-r border-gray-100">
                                                <input
                                                    className="w-full px-4 py-3 border-none focus:ring-2 focus:ring-inset focus:ring-gray-900 outline-none bg-transparent text-black placeholder:text-gray-500 font-medium"
                                                    placeholder="Escribe el nombre..."
                                                    value={row.name}
                                                    onChange={(e) => handleManualRowChange(row.id, 'name', e.target.value)}
                                                />
                                            </td>
                                            <td className="p-0">
                                                <input
                                                    className="w-full px-4 py-3 border-none focus:ring-2 focus:ring-inset focus:ring-gray-900 outline-none bg-transparent font-mono text-black placeholder:text-gray-500 font-medium"
                                                    placeholder="+34..."
                                                    value={row.phone}
                                                    onChange={(e) => handleManualRowChange(row.id, 'phone', e.target.value)}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-3 border-t bg-gray-50/50 flex justify-center">
                            <Button variant="ghost" size="sm" onClick={handleAddManualRow} className="text-gray-500 hover:text-gray-900">
                                <Plus className="mr-2 h-4 w-4" /> Añadir más filas
                            </Button>
                        </div>
                        <div className="p-4 border-t bg-white flex justify-end gap-3 sticky bottom-0">
                            <Button variant="outline" onClick={() => saveManualContacts(false)}>
                                <Save className="mr-2 h-4 w-4" /> Guardar
                            </Button>
                            <Button onClick={() => saveManualContacts(true)} className="bg-gray-900 text-white hover:bg-black">
                                <Play className="mr-2 h-4 w-4" /> Guardar y Lanzar Campaña
                            </Button>
                        </div>
                    </div>
                ) : (
                    // READ ONLY TABLE
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50/50 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-900 uppercase tracking-wider">Nombre</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-900 uppercase tracking-wider">Teléfono</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-900 uppercase tracking-wider">Estado</th>
                                <th className="px-6 py-3 text-right text-xs font-bold text-gray-900 uppercase tracking-wider">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {contacts.map((contact) => (
                                <tr key={contact.id} className="group hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-3 font-medium text-gray-900">{contact.name}</td>
                                    <td className="px-6 py-3 text-gray-500 font-mono">{contact.phone}</td>
                                    <td className="px-6 py-3">
                                        <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-semibold border uppercase tracking-wide", getStatusColor(contact.status))}>
                                            {contact.status.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3 text-right">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 hover:bg-gray-100 text-gray-400 hover:text-gray-900 transition-all">
                                            <Phone className="h-3.5 w-3.5" />
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                            {contacts.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={4} className="py-16 text-center">
                                        <div className="h-12 w-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                            <Users className="h-6 w-6 text-gray-900" />
                                        </div>
                                        <p className="text-gray-900 font-bold text-lg">No hay contactos todavía</p>
                                        <p className="text-gray-600 mt-1 font-medium">Usa uno de los botones de arriba para empezar.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}

            </div>
        </div>
    );
}
