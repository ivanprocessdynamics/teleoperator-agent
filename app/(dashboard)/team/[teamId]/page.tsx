"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { collection, getDocs, doc, getDoc, updateDoc, deleteDoc, query, where, orderBy, documentId } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Loader2, MoreVertical, Shield, User, LogIn, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { InviteUserModal } from "@/components/team/InviteUserModal";

interface MemberData {
    uid: string;
    email: string;
    role: "admin" | "member";
    joined_at: any;
    isOwner?: boolean; // Mark if this is the workspace owner
}

interface WorkspaceData {
    id: string;
    name: string;
    owner_uid: string;
}

export default function TeamDetailPage() {
    const params = useParams();
    const teamId = params.teamId as string; // This corresponds to workspaceId
    const { userData, startImpersonating } = useAuth();
    const [members, setMembers] = useState<MemberData[]>([]);
    const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        if (!userData || !teamId) return;
        fetchData();
    }, [teamId, userData]);

    const fetchData = async () => {
        try {
            setLoading(true);

            // 1. Fetch Workspace Details
            const wsRef = doc(db, "workspaces", teamId);
            const wsSnap = await getDoc(wsRef);

            if (!wsSnap.exists()) {
                toast.error("Equipo no encontrado");
                router.push("/team");
                return;
            }

            setWorkspace({ id: wsSnap.id, ...wsSnap.data() } as WorkspaceData);

            const ownerUid = wsSnap.data().owner_uid;

            // 2. Fetch Members from subcollection
            const membersRef = collection(db, "workspaces", teamId, "members");
            const membersSnap = await getDocs(membersRef);

            const membersList: MemberData[] = membersSnap.docs.map(doc => doc.data() as MemberData);

            // 3. Check if owner is already in members list, if not add them
            const ownerInList = membersList.find(m => m.uid === ownerUid);
            if (!ownerInList && ownerUid) {
                // Fetch owner's email from users collection
                const ownerUserRef = doc(db, "users", ownerUid);
                const ownerUserSnap = await getDoc(ownerUserRef);

                if (ownerUserSnap.exists()) {
                    const ownerData = ownerUserSnap.data();
                    membersList.unshift({
                        uid: ownerUid,
                        email: ownerData.email || "Owner",
                        role: "admin", // Owner is always admin
                        joined_at: wsSnap.data().created_at || null,
                        isOwner: true // Mark as owner for special display
                    } as MemberData & { isOwner?: boolean });
                }
            } else if (ownerInList) {
                // Mark existing owner entry
                (ownerInList as MemberData & { isOwner?: boolean }).isOwner = true;
            }

            setMembers(membersList);

        } catch (error) {
            console.error("Error fetching team data:", error);
            toast.error("Error al cargar datos del equipo");
        } finally {
            setLoading(false);
        }
    };

    const handleRoleChange = async (memberUid: string, currentRole: "admin" | "member") => {
        const newRole = currentRole === 'admin' ? 'member' : 'admin';
        try {
            await updateDoc(doc(db, "workspaces", teamId, "members", memberUid), {
                role: newRole
            });

            // Optimistic update
            setMembers(prev => prev.map(m => m.uid === memberUid ? { ...m, role: newRole } : m));
            toast.success("Rol actualizado");
        } catch (error) {
            console.error("Error updating role:", error);
            toast.error("Error al actualizar rol");
        }
    };

    const handleRemoveMember = async (memberUid: string) => {
        if (!confirm("¿Estás seguro de que quieres eliminar a este miembro del equipo?")) return;

        try {
            await deleteDoc(doc(db, "workspaces", teamId, "members", memberUid));
            setMembers(prev => prev.filter(m => m.uid !== memberUid));
            toast.success("Miembro eliminado");
        } catch (error) {
            console.error("Error removing member:", error);
            toast.error("Error al eliminar miembro");
        }
    };

    // Check permissions: 
    // SuperAdmin OR Workspace Admin can manage
    const isSuperAdmin = userData?.role === 'superadmin';
    const isWorkspaceAdmin = members.some(m => m.uid === userData?.uid && m.role === 'admin'); // Assuming current user is in members list. 
    // Note: SuperAdmin might NOT be in members list if they are just viewing.

    // Logic: If I am superadmin, I can do anything.
    // If I am Workspace Admin, I can manage (except remove owner?)

    const canManage = isSuperAdmin || isWorkspaceAdmin;

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
        );
    }

    if (!workspace) return null;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.push("/team")}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                        {workspace.name}
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                        Gestiona los miembros de este equipo.
                    </p>
                </div>
                <div className="ml-auto">
                    {canManage && <InviteUserModal workspaceId={teamId} workspaceName={workspace.name} />}
                </div>
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 overflow-hidden shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-50 dark:hover:bg-gray-900/50">
                            <TableHead className="font-semibold text-gray-700 dark:text-gray-300">Usuario</TableHead>
                            <TableHead className="font-semibold text-gray-700 dark:text-gray-300">Email</TableHead>
                            <TableHead className="font-semibold text-gray-700 dark:text-gray-300">Rol en Equipo</TableHead>
                            <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {members.map((m) => (
                            <TableRow key={m.uid} className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs">
                                            {m.email?.substring(0, 2).toUpperCase()}
                                        </div>
                                        <span className="font-medium text-gray-900 dark:text-white">
                                            {m.email?.split('@')[0]}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-gray-500 dark:text-gray-400">
                                    {m.email}
                                </TableCell>
                                <TableCell>
                                    <Badge
                                        variant={m.role === 'admin' || m.isOwner ? "default" : "secondary"}
                                        className={
                                            m.isOwner ? "bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300" :
                                                m.role === 'admin' ? "bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-300" :
                                                    "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
                                        }
                                    >
                                        {m.isOwner ? 'Propietario' : m.role === 'admin' ? 'Admin' : 'Miembro'}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    {canManage && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                {/* Role Management */}
                                                {m.uid !== userData?.uid && ( // Cannot edit self
                                                    <>
                                                        <DropdownMenuItem onClick={() => handleRoleChange(m.uid, m.role)}>
                                                            <Shield className="mr-2 h-4 w-4" />
                                                            {m.role === 'admin' ? 'Hacer Miembro' : 'Hacer Admin'}
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleRemoveMember(m.uid)} className="text-red-600 focus:text-red-600">
                                                            <User className="mr-2 h-4 w-4" />
                                                            Eliminar del Equipo
                                                        </DropdownMenuItem>
                                                    </>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
