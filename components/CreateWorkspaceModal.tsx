"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addDoc, collection, serverTimestamp, updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
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

export function CreateWorkspaceModal({ children }: { children?: React.ReactNode }) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState("");
    const [loading, setLoading] = useState(false);
    const { user } = useAuth();
    const router = useRouter();

    const [error, setError] = useState(false);

    const handleCreate = async () => {
        if (!user) return;

        if (!name.trim()) {
            setError(true);
            return;
        }

        setLoading(true);
        try {
            // Create Workspace
            const workspaceRef = await addDoc(collection(db, "workspaces"), {
                name: name,
                owner_uid: user.uid,
                created_at: serverTimestamp(),
            });

            // Update User's current workspace
            await updateDoc(doc(db, "users", user.uid), {
                current_workspace_id: workspaceRef.id,
            });

            setOpen(false);
            setName("");
            setError(false);
        } catch (error) {
            console.error("Error creating workspace:", error);
            alert("Failed to create workspace. Check console for details.");
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
                    <DialogTitle className="text-xl font-bold tracking-tight text-gray-900">Crear Agente</DialogTitle>
                    <DialogDescription className="text-gray-500">
                        Crea un nuevo agente para gestionar tus campañas.
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
                            className={`col-span-3 bg-white text-gray-900 focus:ring-blue-500 ${error
                                    ? "border-red-500 focus:border-red-500 ring-red-500 placeholder:text-red-300"
                                    : "border-gray-300 focus:border-blue-500"
                                }`}
                            placeholder="Ej: Agente de Ventas"
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
