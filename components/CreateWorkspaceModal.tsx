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

    const handleCreate = async () => {
        if (!name.trim() || !user) return;

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
            // Router refresh might not be enough if the dashboard page doesn't fetch data yet
            // But once we add the listener to Dashboard, this won't be needed either.
            // window.location.reload(); 
        } catch (error) {
            console.error("Error creating workspace:", error);
            alert("Failed to create workspace. Check console for details.");
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
                    <DialogTitle className="text-xl font-bold tracking-tight text-gray-900">Crear Agente</DialogTitle>
                    <DialogDescription className="text-gray-500">
                        Crea un nuevo agente para gestionar tus campañas.
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
                            placeholder="Ej: Agente de Ventas"
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
