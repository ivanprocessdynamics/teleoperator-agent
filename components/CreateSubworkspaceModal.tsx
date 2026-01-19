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
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Crear Agente (Sub-espacio)</DialogTitle>
                    <DialogDescription>
                        Crea un nuevo entorno de agente con sus propios contactos y prompts.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">
                            Nombre
                        </Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="col-span-3"
                            placeholder="Ej: Agente de Soporte"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleCreate} disabled={loading}>
                        {loading ? "Creando..." : "Crear Agente"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
