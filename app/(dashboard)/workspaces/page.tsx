"use client";

import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { CreateWorkspaceModal } from "@/components/CreateWorkspaceModal";
import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { SkeletonPage } from "@/components/ui/skeleton";

export default function WorkspacesPage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [workspaces, setWorkspaces] = useState<any[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(true);

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

            // Sort client-side by creation time descending
            spaces.sort((a: any, b: any) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0));

            setWorkspaces(spaces);
            setIsLoadingData(false);

            // Auto-redirect to the first workspace if available
            if (spaces.length > 0) {
                router.push(`/workspaces/${spaces[0].id}`);
            }
        });

        return () => unsubscribe();
    }, [user, router]);

    if (loading || isLoadingData) {
        return <SkeletonPage />;
    }

    // Only show this if there are NO workspaces (empty state)
    // Otherwise the user is redirected immediately
    if (workspaces.length === 0) {
        return (
            <div className="flex flex-col gap-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Workspaces</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">No tienes ningun workspace creado.</p>
                </div>

                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 p-8 text-center text-gray-500 dark:text-gray-400">
                    <p className="mb-4">Empieza creando tu primer Workspace.</p>
                    <CreateWorkspaceModal>
                        <Button variant="outline">
                            <Plus className="mr-2 h-4 w-4" />
                            Crear Workspace
                        </Button>
                    </CreateWorkspaceModal>
                </div>
            </div>
        );
    }

    // Fallback while redirecting
    return <div className="flex h-full items-center justify-center text-gray-400 dark:text-gray-500">Redirigiendo...</div>;
}

