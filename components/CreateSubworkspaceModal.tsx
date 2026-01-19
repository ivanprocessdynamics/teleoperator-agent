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

    const handleCreate = async () => {
        if (!name.trim() || !workspaceId) return;

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
            router.refresh();
            window.location.reload();
        } catch (error) {
            console.error("Error creating subworkspace:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {children || (
                    <Button>
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
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right text-gray-700 font-medium">
                            Nombre
                        </Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="col-span-3 bg-white border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                            placeholder="Ej: Agente de Soporte"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button
                        onClick={handleCreate}
                        disabled={loading}
                        className="bg-gray-900 text-white hover:bg-gray-800"
                    >
                        {loading ? "Creando..." : "Crear Agente"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
