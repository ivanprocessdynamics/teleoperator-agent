"use client";

import { useState } from "react";
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
import { Trash2, Loader2 } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";

interface DataResetButtonProps {
    type: 'campaign' | 'subworkspace';
    id: string;
    className?: string;
    variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
    label?: string;
}

export function DataResetButton({ type, id, className, variant = "destructive", label = "Borrar Historial" }: DataResetButtonProps) {
    const [isDeleting, setIsDeleting] = useState(false);
    const [open, setOpen] = useState(false);

    const handleReset = async () => {
        setIsDeleting(true);
        try {
            const res = await authFetch('/api/data/reset', {
                method: 'POST',
                body: JSON.stringify({ type, id })
            });

            if (!res.ok) throw new Error("Error deleting data");

            const data = await res.json();

            // Just close dialog, maybe refresh page?
            setOpen(false);
            window.location.reload(); // Simple way to refresh data
        } catch (error) {
            console.error(error);
            alert("Error al borrar los datos");
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant={variant} className={className} size="sm">
                    <Trash2 className="h-4 w-4 mr-2" />
                    {label}
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>¿Estás absolutamente seguro?</DialogTitle>
                    <DialogDescription>
                        Esta acción no se puede deshacer. Se borrarán permanentemente todos los registros de llamadas y estadísticas asociadas a {type === 'campaign' ? 'esta campaña' : 'este agente'}.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={isDeleting}>Cancelar</Button>
                    <Button
                        onClick={(e) => { e.preventDefault(); handleReset(); }}
                        className="bg-red-600 hover:bg-red-700 text-white"
                        disabled={isDeleting}
                    >
                        {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        {isDeleting ? "Borrando..." : "Sí, borrar todo"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
