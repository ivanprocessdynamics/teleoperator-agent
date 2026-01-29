"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Phone, Check, Loader2, PhoneIncoming, AlertTriangle } from "lucide-react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface PhoneNumber {
    phone_number: string;
    inbound_agent_id?: string;
    nickname?: string;
}

interface ConnectPhoneNumberModalProps {
    agentId: string;
    trigger?: React.ReactNode;
}

export function ConnectPhoneNumberModal({ agentId, trigger }: ConnectPhoneNumberModalProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
    const [agentNames, setAgentNames] = useState<Record<string, string>>({});
    const [selectedNumbers, setSelectedNumbers] = useState<string[]>([]);
    const [processing, setProcessing] = useState(false);

    // Fetch data when modal opens
    useEffect(() => {
        if (open) {
            fetchData();
        }
    }, [open]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Phone Numbers from Retell
            const res = await fetch("/api/retell/get-phone-numbers");
            if (!res.ok) throw new Error("Failed to fetch numbers");
            const data: PhoneNumber[] = await res.json();

            // 2. Fetch all subworkspaces to map Agent IDs to Names
            const subSnap = await getDocs(collection(db, "subworkspaces"));
            const nameMap: Record<string, string> = {};
            subSnap.forEach(doc => {
                const d = doc.data();
                if (d.retell_agent_id) {
                    nameMap[d.retell_agent_id] = d.name;
                }
            });
            setAgentNames(nameMap);
            setPhoneNumbers(data);

            // 3. Pre-select numbers currently assigned to THIS agent
            const current = data
                .filter(p => p.inbound_agent_id === agentId)
                .map(p => p.phone_number);
            setSelectedNumbers(current);

        } catch (error) {
            console.error("Error loading data:", error);
            toast.error("Error al cargar los números de teléfono");
        } finally {
            setLoading(false);
        }
    };

    const handleToggleNumber = (phone: string) => {
        setSelectedNumbers(prev =>
            prev.includes(phone)
                ? prev.filter(p => p !== phone)
                : [...prev, phone]
        );
    };

    const handleSave = async () => {
        setProcessing(true);
        try {
            // Identify changes
            // For each number in the list:
            // 1. If it's in selectedNumbers but NOT currently assigned to this agent -> Assign it (Disconnects previous)
            // 2. If it's NOT in selectedNumbers but currently assigned to this agent -> Disconnect it (Set agent_id to null)

            const promises = phoneNumbers.map(async (p) => {
                const isSelected = selectedNumbers.includes(p.phone_number);
                const isCurrentlyOwned = p.inbound_agent_id === agentId;

                if (isSelected && !isCurrentlyOwned) {
                    // Connect
                    await updatePhoneNumber(p.phone_number, agentId);
                } else if (!isSelected && isCurrentlyOwned) {
                    // Disconnect
                    await updatePhoneNumber(p.phone_number, null);
                }
            });

            await Promise.all(promises);
            toast.success("Números actualizados correctamente");
            setOpen(false);
        } catch (error) {
            console.error("Error saving:", error);
            toast.error("Error al actualizar la configuración");
        } finally {
            setProcessing(false);
        }
    };

    const updatePhoneNumber = async (phoneNumber: string, newAgentId: string | null) => {
        const res = await fetch("/api/retell/update-phone-number", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                phone_number: phoneNumber,
                inbound_agent_id: newAgentId
            }),
        });
        if (!res.ok) throw new Error(`Failed to update ${phoneNumber}`);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" className="gap-2">
                        <Phone className="h-4 w-4" />
                        Conectar con número
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Conectar con Número</DialogTitle>
                    <DialogDescription>
                        Selecciona los números que deseas asignar a este agente.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-3">
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                        </div>
                    ) : (
                        phoneNumbers.map((p) => {
                            const isSelected = selectedNumbers.includes(p.phone_number);
                            const currentOwnerId = p.inbound_agent_id;
                            const currentOwnerName = currentOwnerId ? agentNames[currentOwnerId] : null;
                            const isOwnedByOther = currentOwnerId && currentOwnerId !== agentId;

                            return (
                                <div
                                    key={p.phone_number}
                                    onClick={() => handleToggleNumber(p.phone_number)}
                                    className={cn(
                                        "flex items-center justify-between p-3 rounded-lg border-2 cursor-pointer transition-all",
                                        isSelected
                                            ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10"
                                            : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "h-10 w-10 rounded-full flex items-center justify-center",
                                            isSelected ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-500"
                                        )}>
                                            <PhoneIncoming className="h-5 w-5" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-gray-900 dark:text-gray-100">
                                                {p.phone_number}
                                            </span>
                                            <span className="text-xs text-gray-500">
                                                {p.nickname || "Retell Number"}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-end gap-1">
                                        {isSelected && (
                                            <Badge className="bg-blue-500 hover:bg-blue-600">
                                                <Check className="h-3 w-3 mr-1" /> Seleccionado
                                            </Badge>
                                        )}

                                        {!isSelected && isOwnedByOther && (
                                            <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded">
                                                <AlertTriangle className="h-3 w-3" />
                                                Conectado a {currentOwnerName || "Otro Agente"}
                                            </div>
                                        )}

                                        {!isSelected && !isOwnedByOther && (
                                            <span className="text-xs text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded font-medium">
                                                Disponible
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}

                    {!loading && phoneNumbers.length === 0 && (
                        <div className="text-center py-6 text-gray-500">
                            No se encontraron números disponibles.
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={processing}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSave} disabled={processing || loading} className="gap-2">
                        {processing && <Loader2 className="h-4 w-4 animate-spin" />}
                        Guardar Cambios
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
