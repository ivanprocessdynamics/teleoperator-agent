"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CreateSubworkspaceModal } from "@/components/CreateSubworkspaceModal";
import { Button } from "@/components/ui/button";
import { Mic, Users, ArrowRight } from "lucide-react";
import Link from "next/link";

interface Subworkspace {
    id: string;
    name: string;
    workspace_id: string;
}

export default function WorkspacePage() {
    const params = useParams();
    const workspaceId = params.workspaceId as string;
    const [subworkspaces, setSubworkspaces] = useState<Subworkspace[]>([]);
    const [loading, setLoading] = useState(true);
    const [workspaceName, setWorkspaceName] = useState("");

    useEffect(() => {
        async function fetchData() {
            if (!workspaceId) return;

            try {
                // Fetch Workspace Name
                const wsRef = doc(db, "workspaces", workspaceId);
                const wsSnap = await getDoc(wsRef);
                if (wsSnap.exists()) {
                    setWorkspaceName(wsSnap.data().name);
                }

                // Fetch Subworkspaces
                const q = query(
                    collection(db, "subworkspaces"),
                    where("workspace_id", "==", workspaceId)
                );
                const querySnapshot = await getDocs(q);
                const subs: Subworkspace[] = [];
                querySnapshot.forEach((doc) => {
                    subs.push({ id: doc.id, ...doc.data() } as Subworkspace);
                });
                setSubworkspaces(subs);
            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, [workspaceId]);

    if (loading) return <div>Loading workspace...</div>;

    return (
        <div className="flex flex-col gap-8">
            <div className="flex items-center justify-between border-b pb-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">{workspaceName || "Workspace"}</h1>
                    <p className="text-gray-500">Manage your agents and campaigns.</p>
                </div>
                <CreateSubworkspaceModal workspaceId={workspaceId} />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {subworkspaces.map((sub) => (
                    <div
                        key={sub.id}
                        className="group relative flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md"
                    >
                        <div>
                            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                                <Mic className="h-5 w-5" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900">{sub.name}</h3>
                            <p className="text-sm text-gray-500">Click to manage contacts and prompts.</p>
                        </div>

                        <div className="mt-6 flex items-center justify-end">
                            <Link href={`/workspaces/${workspaceId}/sub/${sub.id}`}>
                                <Button variant="ghost" className="gap-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                                    Open Agent <ArrowRight className="h-4 w-4" />
                                </Button>
                            </Link>
                        </div>
                    </div>
                ))}

                {subworkspaces.length === 0 && (
                    <div className="col-span-full py-12 text-center text-gray-400 border-dashed border-2 bg-gray-50 rounded-xl">
                        <p>No agents created yet. Create one to start calling.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
