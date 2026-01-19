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
            where("owner_uid", "==", user.uid),
            orderBy("created_at", "desc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const spaces = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data()
            }));
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
                        <Link key={ws.id} href={`/workspaces/${ws.id}`} className="group relative rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md">
                            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600">{ws.name}</h3>
                            <p className="text-sm text-gray-500 mt-2">ID: {ws.id}</p>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
