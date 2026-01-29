"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth, UserData } from "@/contexts/AuthContext";
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
import { Loader2, MoreVertical, Shield, User, LogIn, Mail } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { InviteUserModal } from "@/components/team/InviteUserModal";

export default function TeamPage() {
    const { userData, startImpersonating } = useAuth();
    const [users, setUsers] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        // Simple protection - Allow any role to VIEW
        if (!userData) return;
        fetchUsers();
    }, [userData, router]);

    const fetchUsers = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, "users"));
            const usersList: UserData[] = [];
            querySnapshot.forEach((doc) => {
                usersList.push(doc.data() as UserData);
            });
            setUsers(usersList);
        } catch (error) {
            console.error("Error fetching users:", error);
            toast.error("Error al cargar usuarios");
        } finally {
            setLoading(false);
        }
    };

    const handleRoleChange = async (uid: string, newRole: "admin" | "visitor") => {
        try {
            await updateDoc(doc(db, "users", uid), { role: newRole });

            // Optimistic update
            setUsers(prev => prev.map(u => u.uid === uid ? { ...u, role: newRole } : u));
            toast.success("Rol actualizado correctamente");
        } catch (error) {
            console.error("Error updating role:", error);
            toast.error("Error al actualizar rol");
        }
    };

    const handleImpersonate = async (targetUser: UserData) => {
        if (userData?.role !== 'superadmin') {
            toast.error("Solo el Super Admin puede suplantar identidad");
            return;
        }

        if (targetUser.uid === userData.uid) {
            toast.info("Ya estás en tu propia cuenta");
            return;
        }

        await startImpersonating(targetUser.uid);
        toast.success(`Ahora estás viendo como ${targetUser.email}`);
        router.push("/"); // Redirect to dashboard to see their view
    };

    // ... handles ...

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
        );
    }

    if (!userData) return null;

    const canInvite = userData.role === 'superadmin' || userData.role === 'admin';

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Equipo</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-2">
                        Gestiona los usuarios y accesos de la plataforma.
                    </p>
                </div>
                {canInvite && <InviteUserModal />}
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 overflow-hidden shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-50 dark:hover:bg-gray-900/50">
                            <TableHead className="font-semibold text-gray-700 dark:text-gray-300">Usuario</TableHead>
                            <TableHead className="font-semibold text-gray-700 dark:text-gray-300">Email</TableHead>
                            <TableHead className="font-semibold text-gray-700 dark:text-gray-300">Rol</TableHead>
                            <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.map((u) => (
                            <TableRow key={u.uid} className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs">
                                            {u.email?.substring(0, 2).toUpperCase()}
                                        </div>
                                        <span className="font-medium text-gray-900 dark:text-white">
                                            {u.email?.split('@')[0]}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-gray-500 dark:text-gray-400">
                                    {u.email}
                                </TableCell>
                                <TableCell>
                                    <Badge
                                        variant={u.role === 'superadmin' ? "default" : u.role === 'admin' ? "secondary" : "outline"}
                                        className={
                                            u.role === 'superadmin' ? "bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-300" :
                                                u.role === 'admin' ? "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300" :
                                                    "text-gray-600 dark:text-gray-400"
                                        }
                                    >
                                        {u.role === 'superadmin' ? 'Super Admin' :
                                            u.role === 'admin' ? 'Administrador' : 'Visitante'}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    {(userData.role === 'superadmin' || (userData.role === 'admin' && u.role === 'visitor')) && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                {/* Super Admin specific actions */}
                                                {userData.role === 'superadmin' && u.role !== 'superadmin' && (
                                                    <DropdownMenuItem onClick={() => handleImpersonate(u)}>
                                                        <LogIn className="mr-2 h-4 w-4" />
                                                        Suplantar Identidad
                                                    </DropdownMenuItem>
                                                )}

                                                {/* Role Management */}
                                                {(userData.role === 'superadmin' || (userData.role === 'admin' && u.role === 'visitor')) && u.uid !== userData.uid && (
                                                    <>
                                                        {/* Prevent modifying Super Admins */}
                                                        {u.role !== 'superadmin' && (
                                                            <DropdownMenuItem onClick={() => handleRoleChange(u.uid, u.role === 'admin' ? 'visitor' : 'admin')}>
                                                                <Shield className="mr-2 h-4 w-4" />
                                                                {u.role === 'admin' ? 'Hacer Visitante' : 'Hacer Admin'}
                                                            </DropdownMenuItem>
                                                        )}
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
