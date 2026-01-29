"use client";

import { useAuth } from "@/contexts/AuthContext";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Loader2, Mail, Plus } from "lucide-react";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";

interface InviteUserModalProps {
    workspaceId?: string;
    workspaceName?: string;
}

export function InviteUserModal({ workspaceId, workspaceName }: InviteUserModalProps) {
    const { userData, user } = useAuth();
    const [open, setOpen] = useState(false);
    const [email, setEmail] = useState("");

    // Default to 'member'
    const [role, setRole] = useState<"admin" | "member">("member");
    const [loading, setLoading] = useState(false);

    const handleOpenChange = (open: boolean) => {
        setOpen(open);
        if (!open) {
            setEmail("");
            setRole("member");
        } else {
            // Reset to member when opening to be safe
            setRole("member");
        }
    };

    const handleInvite = async () => {
        if (!email.trim()) return;
        setLoading(true);
        try {
            // Fetch workspace name if not provided
            let wsName = workspaceName;
            if (workspaceId && !wsName) {
                try {
                    const wsDoc = await getDoc(doc(db, "workspaces", workspaceId));
                    if (wsDoc.exists()) {
                        wsName = wsDoc.data().name;
                    }
                } catch (e) {
                    console.warn("Could not fetch workspace name:", e);
                }
            }

            await setDoc(doc(db, "invites", email.toLowerCase().trim()), {
                email: email.toLowerCase().trim(),
                role,
                workspaceId: workspaceId || null,
                workspaceName: wsName || null,
                authorUid: userData?.uid,
                authorEmail: user?.email || userData?.email,
                authorName: user?.displayName || null,
                createdAt: new Date(),
                status: 'pending'
            });

            toast.success(`Invitación creada para ${email}`);
            setOpen(false);
            setEmail("");
            setRole("member");
        } catch (error) {
            console.error("Error creating invite:", error);
            toast.error("Error al crear la invitación");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button>
                    <Mail className="mr-2 h-4 w-4" />
                    Invitar Miembro
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Invitar Miembro</DialogTitle>
                    <DialogDescription>
                        Pre-aprueba el acceso para un nuevo usuario. Cuando inicien sesión con Google, se les asignará el rol seleccionado.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="email">Correo Electrónico</Label>
                        <Input
                            id="email"
                            placeholder="usuario@ejemplo.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="role">Rol</Label>
                        <Select value={role} onValueChange={(v) => setRole(v as "admin" | "member")}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecciona un rol" />
                            </SelectTrigger>
                            <SelectContent>
                                {userData?.role === 'superadmin' && (
                                    <SelectItem value="admin">Administrador</SelectItem>
                                )}
                                <SelectItem value="member">Miembro</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                        Cancelar
                    </Button>
                    <Button onClick={handleInvite} disabled={loading || !email}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Enviar Invitación
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
