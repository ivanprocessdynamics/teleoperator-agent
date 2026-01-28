"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addDoc, collection, serverTimestamp, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { RETELL_AGENT_SLOTS, RetellAgentSlot } from "@/lib/retell-agents";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Mic, PhoneIncoming, PhoneOutgoing } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface CreateSubworkspaceModalProps {
    workspaceId: string;
    children?: React.ReactNode;
}

const COLORS = [
    { name: 'gray', class: 'bg-gray-100 text-gray-600', pickerClass: 'bg-gray-500', hover: 'hover:bg-gray-200' },
    { name: 'blue', class: 'bg-blue-50 text-blue-600', pickerClass: 'bg-blue-500', hover: 'hover:bg-blue-100' },
    { name: 'green', class: 'bg-green-50 text-green-600', pickerClass: 'bg-green-500', hover: 'hover:bg-green-100' },
    { name: 'yellow', class: 'bg-yellow-50 text-yellow-600', pickerClass: 'bg-yellow-500', hover: 'hover:bg-yellow-100' },
    { name: 'red', class: 'bg-red-50 text-red-600', pickerClass: 'bg-red-500', hover: 'hover:bg-red-100' },
    { name: 'purple', class: 'bg-purple-50 text-purple-600', pickerClass: 'bg-purple-500', hover: 'hover:bg-purple-100' },
    { name: 'pink', class: 'bg-pink-50 text-pink-600', pickerClass: 'bg-pink-500', hover: 'hover:bg-pink-100' },
    { name: 'orange', class: 'bg-orange-50 text-orange-600', pickerClass: 'bg-orange-500', hover: 'hover:bg-orange-100' },
];

type AgentType = 'outbound' | 'inbound';

export function CreateSubworkspaceModal({ workspaceId, children }: CreateSubworkspaceModalProps) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState("");
    const [selectedColor, setSelectedColor] = useState("blue");
    const [agentType, setAgentType] = useState<AgentType>('outbound');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const [error, setError] = useState(false);

    const handleCreate = async () => {
        if (!workspaceId) return;

        if (!name.trim()) {
            setError(true);
            return;
        }

        setLoading(true);
        try {
            // Find the next available Retell slot (Globally across all workspaces)
            // Filter by type: outbound slots for outbound, inbound slots for inbound
            const existingSubsQuery = query(
                collection(db, "subworkspaces"),
                where("type", "==", agentType) // Optional: strictly seperate pools or just rely on 'retell_slot'
            );

            // To be safe and simple: Fetch ALL subworkspaces and check used slots manually based on type
            // Actually, existing implementation was checking ALL subworkspaces. 
            // We should ideally check if the slot is used by another agent of the SAME TYPE?
            // Or does "slot 1" exist for both types?
            // Yes, slot 1 can exist for inbound AND outbound if they map to different actual agentIds.

            // Let's check used slots for THIS specific type.
            const allSubsSnap = await getDocs(collection(db, "subworkspaces"));
            const usedSlots = allSubsSnap.docs
                .filter(doc => doc.data().type === agentType || (!doc.data().type && agentType === 'outbound')) // Default to outbound
                .map(doc => doc.data().retell_slot)
                .filter((slot): slot is number => typeof slot === 'number');

            // Select the pool based on type (Now handling both types with the same pool of real IDs)
            const pool = RETELL_AGENT_SLOTS;
            const maxSlots = pool.length;

            // Find next available slot
            let nextSlot = 1;
            for (let i = 1; i <= maxSlots; i++) {
                if (!usedSlots.includes(i)) {
                    nextSlot = i;
                    break;
                }
            }

            const assignedSlot = pool.find(s => s.slot === nextSlot);

            await addDoc(collection(db, "subworkspaces"), {
                workspace_id: workspaceId,
                name: name,
                color: selectedColor,
                type: agentType,
                retell_slot: nextSlot,
                retell_agent_id: assignedSlot?.agentId || "",
                active_prompt: "",
                prompt_core_text: "You are a helpful assistant.",
                prompt_editable_text: "Your goal is to...",
                created_at: serverTimestamp(),
            });

            setOpen(false);
            setName("");
            setSelectedColor("blue");
            setAgentType('outbound');
            setError(false);
            router.refresh();
            window.location.reload();
        } catch (error) {
            console.error("Error creating subworkspace:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleCreate();
        }
    };

    return (
        <Dialog open={open} onOpenChange={(val) => {
            setOpen(val);
            if (!val) {
                setName("");
                setSelectedColor("blue");
                setAgentType('outbound');
                setError(false);
            }
        }}>
            <DialogTrigger asChild>
                {children || (
                    <Button variant="outline" className="bg-white dark:bg-blue-500/10 text-gray-900 dark:text-blue-100 border-gray-200 dark:border-blue-500/30 hover:bg-gray-50 dark:hover:bg-blue-500/20">
                        <Plus className="mr-2 h-4 w-4" />
                        Nuevo Agente
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-700 shadow-xl">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">Crear Agente</DialogTitle>
                    <DialogDescription className="text-gray-500 dark:text-gray-400">
                        Configura tu nuevo agente de IA.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-6 py-4">
                    {/* Agent Type Selection */}
                    <div className="grid grid-cols-2 gap-4">
                        <div
                            className={cn(
                                "cursor-pointer rounded-xl border-2 p-4 flex flex-col items-center gap-3 transition-all duration-200",
                                agentType === 'outbound'
                                    ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10"
                                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-transparent"
                            )}
                            onClick={() => setAgentType('outbound')}
                        >
                            <div className={cn(
                                "h-10 w-10 rounded-full flex items-center justify-center transition-colors",
                                agentType === 'outbound' ? "bg-blue-500 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-500"
                            )}>
                                <PhoneOutgoing className="h-5 w-5" />
                            </div>
                            <div className="text-center">
                                <span className={cn("block text-sm font-semibold", agentType === 'outbound' ? "text-blue-700 dark:text-blue-300" : "text-gray-700 dark:text-gray-300")}>Saliente</span>
                                <span className="text-[10px] text-gray-500 dark:text-gray-400">Para campañas de llamadas</span>
                            </div>
                        </div>

                        <div
                            className={cn(
                                "cursor-pointer rounded-xl border-2 p-4 flex flex-col items-center gap-3 transition-all duration-200",
                                agentType === 'inbound'
                                    ? "border-green-500 bg-green-50 dark:bg-green-500/10"
                                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-transparent"
                            )}
                            onClick={() => setAgentType('inbound')}
                        >
                            <div className={cn(
                                "h-10 w-10 rounded-full flex items-center justify-center transition-colors",
                                agentType === 'inbound' ? "bg-green-500 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-500"
                            )}>
                                <PhoneIncoming className="h-5 w-5" />
                            </div>
                            <div className="text-center">
                                <span className={cn("block text-sm font-semibold", agentType === 'inbound' ? "text-green-700 dark:text-green-300" : "text-gray-700 dark:text-gray-300")}>Entrante</span>
                                <span className="text-[10px] text-gray-500 dark:text-gray-400">Recibe llamadas a un número</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <Label>Nombre y Color</Label>
                        <div className="flex gap-3">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <div
                                        className={cn(
                                            "flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-transform hover:scale-105 active:scale-95 outline-none",
                                            COLORS.find(c => c.name === selectedColor)?.class
                                        )}
                                    >
                                        {agentType === 'inbound' ? (
                                            <PhoneIncoming className="h-5 w-5" />
                                        ) : (
                                            <Mic className="h-5 w-5" />
                                        )}
                                    </div>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="p-2 w-auto bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-xl" align="start">
                                    <div className="grid grid-cols-4 gap-2">
                                        {COLORS.map((color) => (
                                            <div
                                                key={color.name}
                                                onClick={() => setSelectedColor(color.name)}
                                                className={cn(
                                                    "h-8 w-8 rounded-md cursor-pointer border border-transparent hover:scale-110 transition-all flex items-center justify-center",
                                                    color.pickerClass,
                                                    selectedColor === color.name && "ring-2 ring-offset-2 ring-gray-900 dark:ring-white border-transparent scale-110"
                                                )}
                                            />
                                        ))}
                                    </div>
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => {
                                    setName(e.target.value);
                                    if (e.target.value.trim()) setError(false);
                                }}
                                onKeyDown={handleKeyDown}
                                className={`flex-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 placeholder:text-gray-400 dark:placeholder:text-gray-500 ${error
                                    ? "border-red-500 focus:border-red-500 ring-red-500 placeholder:text-red-300"
                                    : "border-gray-300 dark:border-gray-600 focus:border-blue-500"
                                    }`}
                                placeholder="Ej: Agente de Soporte"
                            />
                        </div>
                    </div>
                </div>
                <DialogFooter className="sm:justify-center">
                    <Button
                        onClick={handleCreate}
                        disabled={loading}
                        className="w-full bg-gray-900 dark:bg-blue-600 text-white dark:text-white hover:bg-gray-800 dark:hover:bg-blue-700"
                    >
                        {loading ? "Creando..." : "Crear Agente"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
