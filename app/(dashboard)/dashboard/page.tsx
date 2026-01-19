"use client";

import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { CreateWorkspaceModal } from "@/components/CreateWorkspaceModal";
import { useEffect, useState } from "react";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";

export default function DashboardPage() {
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
            const spaces = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data()
            }));
            // Sort client-side to avoid needing a composite index
            spaces.sort((a: any, b: any) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0));
            setWorkspaces(spaces);
        });

        return () => unsubscribe();
    }, [user]);

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">Workspaces</h1>
                <CreateWorkspaceModal />
            </div>

            {workspaces.length === 0 ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-8 text-center text-gray-500">
                    <p className="mb-4">No workspaces found. Create one to get started.</p>
                    <CreateWorkspaceModal>
                        <Button variant="outline">
                            <Plus className="mr-2 h-4 w-4" />
                            Create Workspace
                        </Button>
                    </CreateWorkspaceModal>
                </div>
            ) : (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {workspaces.map((ws) => (
                        <Link
                            key={ws.id}
                            href={`/workspaces/${ws.id}`}
                            className="group relative flex flex-col justify-between rounded-xl border border-gray-100 bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-gray-200"
                        >
                            <div>
                                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition-colors">
                                    <span className="font-semibold text-lg">{ws.name.charAt(0).toUpperCase()}</span>
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">{ws.name}</h3>
                                <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                                    Manage campaigns and agents for {ws.name}.
                                </p>
                            </div>
                            <div className="mt-4 flex items-center justify-between border-t border-gray-50 pt-4">
                                <span className="text-xs text-gray-400 font-mono">ID: {ws.id.substring(0, 8)}...</span>
                                <span className="text-xs font-medium text-gray-400 group-hover:text-gray-600">
                                    {ws.created_at ? new Date(ws.created_at.seconds * 1000).toLocaleDateString() : 'Just now'}
                                </span>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
