"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { collection, query, where, onSnapshot, collectionGroup, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { ChevronDown, Check, Box } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface Workspace {
    id: string;
    name: string;
}

export function WorkspaceSelector() {
    const { userData, user } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
    const [loading, setLoading] = useState(true);

    // Extract current workspace ID from URL
    const currentWorkspaceId = pathname?.match(/\/workspaces\/([^\/]+)/)?.[1];

    useEffect(() => {
        if (!userData?.uid) return;

        const fetchWorkspaces = async () => {
            setLoading(true);
            try {
                let allWorkspaces: Workspace[] = [];

                if (userData.role === 'superadmin') {
                    // Superadmin sees all workspaces
                    const unsubscribe = onSnapshot(collection(db, "workspaces"), (snapshot) => {
                        allWorkspaces = snapshot.docs.map(doc => ({
                            id: doc.id,
                            name: doc.data().name || "Sin nombre"
                        }));
                        allWorkspaces.sort((a, b) => a.name.localeCompare(b.name));
                        setWorkspaces(allWorkspaces);
                        setLoading(false);

                        // Set current workspace
                        if (currentWorkspaceId) {
                            const current = allWorkspaces.find(w => w.id === currentWorkspaceId);
                            setCurrentWorkspace(current || null);
                        }
                    });
                    return () => unsubscribe();
                } else {
                    // Regular users: get workspaces where they are members
                    const membersQuery = query(
                        collectionGroup(db, "members"),
                        where("uid", "==", userData.uid)
                    );
                    const membersSnap = await getDocs(membersQuery);

                    for (const memberDoc of membersSnap.docs) {
                        const workspaceRef = memberDoc.ref.parent.parent;
                        if (workspaceRef) {
                            const wsId = workspaceRef.id;
                            // Get workspace name from path or fetch
                            const wsPath = workspaceRef.path;
                            allWorkspaces.push({ id: wsId, name: wsId }); // Placeholder, will be updated
                        }
                    }

                    // Also add owned workspaces
                    const ownedQuery = query(
                        collection(db, "workspaces"),
                        where("owner_uid", "==", userData.uid)
                    );
                    const ownedSnap = await getDocs(ownedQuery);
                    for (const doc of ownedSnap.docs) {
                        if (!allWorkspaces.find(w => w.id === doc.id)) {
                            allWorkspaces.push({
                                id: doc.id,
                                name: doc.data().name || "Sin nombre"
                            });
                        }
                    }

                    // Update names for member workspaces
                    const workspacesRef = collection(db, "workspaces");
                    const allWsSnap = await getDocs(workspacesRef);
                    const wsMap = new Map(allWsSnap.docs.map(d => [d.id, d.data().name || "Sin nombre"]));

                    allWorkspaces = allWorkspaces.map(w => ({
                        ...w,
                        name: wsMap.get(w.id) || w.name
                    }));

                    // Remove duplicates
                    const seen = new Set();
                    allWorkspaces = allWorkspaces.filter(w => {
                        if (seen.has(w.id)) return false;
                        seen.add(w.id);
                        return true;
                    });

                    allWorkspaces.sort((a, b) => a.name.localeCompare(b.name));
                    setWorkspaces(allWorkspaces);
                    setLoading(false);

                    if (currentWorkspaceId) {
                        const current = allWorkspaces.find(w => w.id === currentWorkspaceId);
                        setCurrentWorkspace(current || null);
                    }
                }
            } catch (error) {
                console.error("Error fetching workspaces:", error);
                setLoading(false);
            }
        };

        fetchWorkspaces();
    }, [userData, currentWorkspaceId]);

    // Update current workspace when URL changes
    useEffect(() => {
        if (currentWorkspaceId && workspaces.length > 0) {
            const current = workspaces.find(w => w.id === currentWorkspaceId);
            setCurrentWorkspace(current || null);
        }
    }, [currentWorkspaceId, workspaces]);

    const handleSelectWorkspace = (workspace: Workspace) => {
        // Save to localStorage for other pages (global-stats, historial)
        localStorage.setItem("selectedWorkspaceId", workspace.id);
        router.push(`/workspaces/${workspace.id}`);
    };

    if (loading || workspaces.length === 0) {
        return (
            <div className="flex items-center gap-3 px-3 py-2 text-gray-500 dark:text-gray-400">
                <Box className="h-4 w-4" />
                <span>Workspaces</span>
            </div>
        );
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    className="w-full justify-between px-3 py-2 h-auto text-left font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/50 dark:hover:bg-gray-800/50"
                >
                    <div className="flex items-center gap-3">
                        <Box className="h-4 w-4" />
                        <span className="truncate max-w-[140px]">
                            {currentWorkspace?.name || "Seleccionar workspace"}
                        </span>
                    </div>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
                {workspaces.map((workspace) => (
                    <DropdownMenuItem
                        key={workspace.id}
                        onClick={() => handleSelectWorkspace(workspace)}
                        className="cursor-pointer"
                    >
                        <div className="flex items-center justify-between w-full">
                            <span className="truncate">{workspace.name}</span>
                            {currentWorkspace?.id === workspace.id && (
                                <Check className="h-4 w-4 text-green-500" />
                            )}
                        </div>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
