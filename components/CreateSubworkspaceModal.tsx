"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
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
import { Plus } from "lucide-react";

interface CreateSubworkspaceModalProps {
    workspaceId: string;
    children?: React.ReactNode;
}

export function CreateSubworkspaceModal({ workspaceId, children }: CreateSubworkspaceModalProps) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState("");
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
            await addDoc(collection(db, "subworkspaces"), {
                workspace_id: workspaceId,
                name: name,
                prompt_core_text: "You are a helpful assistant.",
                prompt_editable_text: "Your goal is to...",
                created_at: serverTimestamp(),
            });

            setOpen(false);
            setName("");
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
                setError(false);
            }
        }}>
            <DialogTrigger asChild>
                {children || (
                    <Button variant="outline" className="bg-white text-gray-900 border-gray-200 hover:bg-gray-50">
                        <Plus className="mr-2 h-4 w-4" />
                        Nuevo Agente
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-white text-gray-900 border-gray-200 shadow-xl">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold tracking-tight text-gray-900">Crear Agente (Sub-espacio)</DialogTitle>
                    <DialogDescription className="text-gray-500">
                        Crea un nuevo entorno de agente con sus propios contactos y prompts.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="flex flex-col gap-4">
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => {
                                setName(e.target.value);
                                if (e.target.value.trim()) setError(false);
                            }}
                            onKeyDown={handleKeyDown}
                            className={`w-full bg-white text-gray-900 focus:ring-blue-500 ${error
                                    ? "border-red-500 focus:border-red-500 ring-red-500 placeholder:text-red-300"
                                    : "border-gray-300 focus:border-blue-500"
                                }`}
                            placeholder="Ej: Agente de Soporte"
                        />
                    </div>
                </div>
                <DialogFooter className="sm:justify-center">
                    <Button
                        onClick={handleCreate}
                        disabled={loading}
                        className="w-full bg-gray-900 text-white hover:bg-gray-800"
                    >
                        {loading ? "Creando..." : "Crear Agente"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
