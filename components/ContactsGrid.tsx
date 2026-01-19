"use client";

import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Play, Plus, Upload, Phone, AlertCircle, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface Contact {
    id: string;
    name: string;
    phone: string;
    custom_data?: string; // JSON string for simplicity in UI
    status: 'not_called' | 'calling' | 'on_call' | 'answered' | 'no_answer';
}

interface ContactsGridProps {
    subworkspaceId: string;
}

export function ContactsGrid({ subworkspaceId }: ContactsGridProps) {
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loading, setLoading] = useState(true);
    const [newName, setNewName] = useState("");
    const [newPhone, setNewPhone] = useState("");

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

    const handleAddContact = async () => {
        if (!newName || !newPhone) return;
        try {
            await addDoc(collection(db, "contacts"), {
                subworkspace_id: subworkspaceId,
                name: newName,
                phone: newPhone,
                status: 'not_called',
                created_at: serverTimestamp(),
                custom_data: '{}'
            });
            setNewName("");
            setNewPhone("");
        } catch (e) {
            console.error("Error adding contact", e);
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

    const launchCampaign = async () => {
        // Logic to iterate and trigger calls
        // For MVP, we'll just log or mock
        const confirmLaunch = window.confirm("Launch campaign for all 'not_called' contacts?");
        if (!confirmLaunch) return;

        for (const contact of contacts) {
            if (contact.status === 'not_called') {
                // Mock status update to simulate call
                await updateDoc(doc(db, "contacts", contact.id), {
                    status: 'calling'
                });

                // In real app, call API here
                // fetch('/api/campaign/trigger', ...)
            }
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900">Lista de Contactos</h2>
                    <p className="text-sm text-gray-500">Gestiona los clientes potenciales para este agente.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="bg-white hover:bg-gray-50 text-gray-700 border-gray-200">
                        <Upload className="mr-2 h-4 w-4" /> Importar CSV
                    </Button>
                    <Button size="sm" onClick={launchCampaign} className="bg-gray-900 hover:bg-black text-white shadow-sm transition-all hover:scale-105">
                        <Play className="mr-2 h-4 w-4" /> Lanzar Campaña
                    </Button>
                </div>
            </div>

            <div className="rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm">
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

                        {/* Add Row */}
                        <tr className="bg-gray-50/30">
                            <td className="px-6 py-2">
                                <Input
                                    placeholder="Nombre nuevo..."
                                    className="h-9 border-transparent bg-transparent hover:bg-white focus:bg-white focus:border-gray-200 focus:ring-0 transition-all placeholder:text-gray-600 font-medium text-gray-900"
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                />
                            </td>
                            <td className="px-6 py-2">
                                <Input
                                    placeholder="+34 600..."
                                    className="h-9 border-transparent bg-transparent hover:bg-white focus:bg-white focus:border-gray-200 focus:ring-0 transition-all font-mono placeholder:text-gray-600 font-medium text-gray-900"
                                    value={newPhone}
                                    onChange={e => setNewPhone(e.target.value)}
                                />
                            </td>
                            <td colSpan={2} className="px-6 py-2">
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-9 w-full justify-start text-gray-700 hover:text-black hover:bg-gray-100 font-medium"
                                    onClick={handleAddContact}
                                    disabled={!newName || !newPhone}
                                >
                                    <Plus className="mr-2 h-3.5 w-3.5" /> Añadir Fila
                                </Button>
                            </td>
                        </tr>
                    </tbody>
                </table>

                {contacts.length === 0 && !loading && (
                    <div className="py-16 text-center">
                        <div className="h-12 w-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                            <Users className="h-6 w-6 text-gray-900" />
                        </div>
                        <p className="text-gray-900 font-bold text-lg">No hay contactos todavía</p>
                        <p className="text-gray-600 mt-1 font-medium">Añade uno manualmente arriba o importa un CSV.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
