"use client";

import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Plus, MoreHorizontal, Trash, Copy } from "lucide-react";
import { CreateWorkspaceModal } from "@/components/CreateWorkspaceModal";
import { useEffect, useState } from "react";
import { collection, query, where, orderBy, onSnapshot, deleteDoc, doc, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function AgentsPage() {
    const { user, userData, loading } = useAuth();

    if (loading) {
        return <div className="flex h-full items-center justify-center">Loading...</div>;
    }

    const [workspaces, setWorkspaces] = useState<any[]>([]);

    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, "workspaces"),
            where("owner_uid", "==", user.uid)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const spaces = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            // Sort client-side
            spaces.sort((a: any, b: any) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0));
            setWorkspaces(spaces);
        });

        return () => unsubscribe();
    }, [user]);

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [agentToDelete, setAgentToDelete] = useState<any>(null);

    const confirmDelete = async () => {
        if (!agentToDelete) return;

        try {
            await deleteDoc(doc(db, "workspaces", agentToDelete.id));
            setDeleteDialogOpen(false);
            setAgentToDelete(null);
        } catch (error) {
            console.error("Error deleting document: ", error);
        }
    };

    const handleDelete = (e: React.MouseEvent, agent: any) => {
        // Do not prevent default/propagation to allow Dropdown to close
        setAgentToDelete(agent);
        setDeleteDialogOpen(true);
    };

    const handleDuplicate = async (e: React.MouseEvent, ws: any) => {
        // Do not prevent default/propagation to allow Dropdown to close
        if (!user) return;

        try {
            await addDoc(collection(db, "workspaces"), {
                name: `${ws.name} (Copy)`,
                owner_uid: user.uid,
                created_at: serverTimestamp(),
            });
        } catch (error) {
            console.error("Error duplicating document: ", error);
        }
    };

    return (
        <div className="flex flex-col gap-6 relative">
            {/* Custom Delete Confirmation Modal */}
            {deleteDialogOpen && agentToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
                    <div className="w-full max-w-md scale-100 transform rounded-2xl bg-white p-8 text-gray-900 shadow-2xl transition-all border border-gray-100">
                        <h3 className="mb-2 text-xl font-bold tracking-tight">Confirmar Eliminación</h3>
                        <p className="mb-8 text-gray-500 leading-relaxed">
                            ¿Estás seguro de eliminar <span className="font-bold text-gray-900">{agentToDelete.name}</span>? Esta acción no se puede deshacer.
                        </p>
                        <div className="flex justify-end gap-3">
                            <Button
                                variant="outline"
                                className="bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                                onClick={() => setDeleteDialogOpen(false)}
                            >
                                Cancelar
                            </Button>
                            <Button
                                variant="destructive"
                                className="bg-red-600 text-white hover:bg-red-700 shadow-sm"
                                onClick={confirmDelete}
                            >
                                Confirmar
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900">Agents</h1>
                    <p className="text-sm text-gray-500">Manage your Retell AI agents.</p>
                </div>
                <CreateWorkspaceModal />
            </div>

            {workspaces.length === 0 ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-8 text-center text-gray-500">
                    <p className="mb-4">No agents found. Create one to get started.</p>
                    <CreateWorkspaceModal>
                        <Button variant="outline">
                            <Plus className="mr-2 h-4 w-4" />
                            Create Agent
                        </Button>
                    </CreateWorkspaceModal>
                </div>
            ) : (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {workspaces.map((ws) => (
                        <div key={ws.id} className="group relative rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md hover:border-blue-200">
                            {/* Card Content (Clickable) */}
                            <Link href={`/workspaces/${ws.id}`} className="block p-6">
                                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition-colors">
                                    <span className="font-semibold text-lg">{ws.name.charAt(0).toUpperCase()}</span>
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">{ws.name}</h3>
                                {/* Removed subtitle as requested */}

                                <div className="mt-8 flex items-center justify-between border-t border-gray-100 pt-4">
                                    <span className="text-xs font-medium text-gray-500 group-hover:text-gray-700">
                                        {ws.created_at ? new Date(ws.created_at.seconds * 1000).toLocaleDateString() : 'Just now'}
                                    </span>
                                </div>
                            </Link>

                            {/* Actions Menu (Absolute Position) - Always visible or highly visible on hover */}
                            <div className="absolute top-4 right-4 z-10">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-400 hover:text-gray-700 hover:bg-gray-100">
                                            <span className="sr-only">Open menu</span>
                                            <MoreHorizontal className="h-5 w-5" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={(e) => handleDuplicate(e, ws)} className="text-gray-900 font-medium cursor-pointer">
                                            <Copy className="mr-2 h-4 w-4" />
                                            Duplicar
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={(e) => handleDelete(e, ws)} className="text-red-600 font-medium cursor-pointer focus:text-red-600">
                                            <Trash className="mr-2 h-4 w-4" />
                                            Eliminar
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
