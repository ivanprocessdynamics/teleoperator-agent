"use client";

import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { CreateWorkspaceModal } from "@/components/CreateWorkspaceModal";

export default function DashboardPage() {
    const { user, userData, loading } = useAuth();

    if (loading) {
        return <div className="flex h-full items-center justify-center">Loading...</div>;
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">Workspaces</h1>
                <CreateWorkspaceModal />
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-8 text-center text-gray-500">
                <p className="mb-4">No workspaces found. Create one to get started.</p>
                <CreateWorkspaceModal>
                    <Button variant="outline">
                        <Plus className="mr-2 h-4 w-4" />
                        Create Workspace
                    </Button>
                </CreateWorkspaceModal>
            </div>
        </div>
    );
}
