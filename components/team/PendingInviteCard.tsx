"use client";

import { useState } from "react";
import { doc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Check, X, Users, Mail, Shield } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export interface PendingInvite {
    id: string; // doc id (email)
    email: string;
    role: "admin" | "member";
    workspaceId: string | null;
    workspaceName?: string;
    authorEmail?: string;
    authorName?: string;
    createdAt?: any;
    status: "pending" | "accepted" | "rejected";
}

interface PendingInviteCardProps {
    invite: PendingInvite;
    onAccept: () => void;
    onReject: () => void;
}

export function PendingInviteCard({ invite, onAccept, onReject }: PendingInviteCardProps) {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);

    const handleAccept = async () => {
        if (!user || !invite.workspaceId) return;

        setLoading(true);
        try {
            // 1. Add user to workspace members
            await setDoc(doc(db, "workspaces", invite.workspaceId, "members", user.uid), {
                uid: user.uid,
                email: user.email,
                role: invite.role,
                joined_at: serverTimestamp()
            });

            // 2. Update invite as accepted
            await updateDoc(doc(db, "invites", invite.id), {
                status: 'accepted',
                acceptedAt: serverTimestamp(),
                uid: user.uid
            });

            toast.success(`Te has unido al equipo "${invite.workspaceName || 'Equipo'}"`);
            onAccept();
        } catch (error) {
            console.error("Error accepting invite:", error);
            toast.error("Error al aceptar la invitación");
        } finally {
            setLoading(false);
        }
    };

    const handleReject = async () => {
        setLoading(true);
        try {
            await updateDoc(doc(db, "invites", invite.id), {
                status: 'rejected',
                rejectedAt: serverTimestamp()
            });

            toast.success("Invitación rechazada");
            onReject();
        } catch (error) {
            console.error("Error rejecting invite:", error);
            toast.error("Error al rechazar la invitación");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-between p-4 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/20 shadow-sm">
            <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center text-amber-600 dark:text-amber-400">
                    <Mail className="h-5 w-5" />
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                            {invite.workspaceName || `Equipo ${invite.workspaceId?.substring(0, 8)}...`}
                        </h3>
                        <Badge
                            variant="secondary"
                            className={
                                invite.role === 'admin'
                                    ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                                    : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                            }
                        >
                            {invite.role === 'admin' ? 'Admin' : 'Miembro'}
                        </Badge>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Invitado por {invite.authorName || invite.authorEmail || 'un administrador'}
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReject}
                    disabled={loading}
                    className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                    <X className="h-4 w-4 mr-1" />
                    Rechazar
                </Button>
                <Button
                    size="sm"
                    onClick={handleAccept}
                    disabled={loading}
                    className="bg-green-600 hover:bg-green-700 text-white"
                >
                    <Check className="h-4 w-4 mr-1" />
                    Aceptar
                </Button>
            </div>
        </div>
    );
}
