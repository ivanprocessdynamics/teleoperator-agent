"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CreateSubworkspaceModal } from "@/components/CreateSubworkspaceModal";
import { Button } from "@/components/ui/button";
import { Mic, Users, ArrowRight, Pencil, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { SkeletonPage } from "@/components/ui/skeleton";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface Subworkspace {
    id: string;
    name: string;
    workspace_id: string;
    color?: string;
}

const COLORS = [
    { name: 'gray', class: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300', hover: 'hover:bg-gray-200', pickerClass: 'bg-gray-500' },
    { name: 'blue', class: 'bg-blue-50 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400', hover: 'hover:bg-blue-100', pickerClass: 'bg-blue-500' },
    { name: 'green', class: 'bg-green-50 text-green-600 dark:bg-green-500/20 dark:text-green-400', hover: 'hover:bg-green-100', pickerClass: 'bg-green-500' },
    { name: 'yellow', class: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-500/20 dark:text-yellow-400', hover: 'hover:bg-yellow-100', pickerClass: 'bg-yellow-500' },
    { name: 'red', class: 'bg-red-50 text-red-600 dark:bg-red-500/20 dark:text-red-400', hover: 'hover:bg-red-100', pickerClass: 'bg-red-500' },
    { name: 'purple', class: 'bg-purple-50 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400', hover: 'hover:bg-purple-100', pickerClass: 'bg-purple-500' },
    { name: 'pink', class: 'bg-pink-50 text-pink-600 dark:bg-pink-500/20 dark:text-pink-400', hover: 'hover:bg-pink-100', pickerClass: 'bg-pink-500' },
    { name: 'orange', class: 'bg-orange-50 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400', hover: 'hover:bg-orange-100', pickerClass: 'bg-orange-500' },
];

export default function WorkspacePage() {
    const params = useParams();
    const workspaceId = params.workspaceId as string;
    const [subworkspaces, setSubworkspaces] = useState<Subworkspace[]>([]);
    const [loading, setLoading] = useState(true);
    const [workspaceName, setWorkspaceName] = useState("");
    const [isEditingName, setIsEditingName] = useState(false);
    const [tempName, setTempName] = useState("");

    // Subworkspace editing state
    const [editingSubId, setEditingSubId] = useState<string | null>(null);
    const [tempSubName, setTempSubName] = useState("");
    const router = useRouter();

    const handleSaveName = async () => {
        if (!tempName.trim()) return;
        try {
            await updateDoc(doc(db, "workspaces", workspaceId), {
                name: tempName
            });
            setWorkspaceName(tempName);
            setIsEditingName(false);
        } catch (error) {
            console.error("Error updating name:", error);
        }
    };

    const handleUpdateColor = async (sub: Subworkspace, newColor: string) => {
        setSubworkspaces(prev => prev.map(s => s.id === sub.id ? { ...s, color: newColor } : s));
        try {
            await updateDoc(doc(db, "subworkspaces", sub.id), { color: newColor });
        } catch (error) {
            console.error("Error updating color:", error);
        }
    };

    const handleUpdateSubName = async () => {
        if (!editingSubId || !tempSubName.trim()) {
            setEditingSubId(null);
            return;
        }

        const subId = editingSubId;
        const newName = tempSubName;

        // Optimistic update
        setSubworkspaces(prev => prev.map(s => s.id === subId ? { ...s, name: newName } : s));
        setEditingSubId(null);

        try {
            await updateDoc(doc(db, "subworkspaces", subId), {
                name: newName
            });
        } catch (error) {
            console.error("Error updating subworkspace name:", error);
        }
    };

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

    if (loading) return <SkeletonPage />;

    return (
        <div className="flex flex-col gap-8">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-4">
                <div>
                    {isEditingName ? (
                        <div className="flex items-center gap-2">
                            <Input
                                value={tempName}
                                onChange={(e) => setTempName(e.target.value)}
                                className="text-2xl font-bold h-10 w-[300px] dark:bg-gray-800 dark:text-white dark:border-gray-600"
                                autoFocus
                            />
                            <Button size="icon" variant="ghost" onClick={handleSaveName} className="text-green-600">
                                <Check className="h-5 w-5" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => setIsEditingName(false)} className="text-red-500">
                                <X className="h-5 w-5" />
                            </Button>
                        </div>
                    ) : (
                        <div
                            className="flex items-center gap-2 group cursor-pointer"
                            onClick={() => {
                                setTempName(workspaceName);
                                setIsEditingName(true);
                            }}
                        >
                            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors">
                                {workspaceName || "Workspace"}
                            </h1>
                            <Pencil className="h-5 w-5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    )}
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Gestiona tus agentes y campañas.</p>
                </div>
                <CreateSubworkspaceModal workspaceId={workspaceId} />
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                {subworkspaces.map((sub) => (
                    <div
                        key={sub.id}
                        onClick={() => router.push(`/workspaces/${workspaceId}/sub/${sub.id}`)}
                        className="group relative flex flex-col justify-between rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-500 dark:hover:bg-gray-750 cursor-pointer overflow-hidden"
                    >
                        {/* Decorative gradient background */}


                        <div className="relative z-10">
                            <div className="flex items-start justify-between mb-4">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <div
                                            className={cn(
                                                "flex h-12 w-12 cursor-pointer items-center justify-center rounded-xl transition-all duration-300 hover:scale-110 active:scale-95 outline-none shadow-sm",
                                                COLORS.find(c => c.name === (sub.color || 'blue'))?.class || COLORS[1].class
                                            )}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <Mic className="h-6 w-6" />
                                        </div>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent className="p-2 w-auto bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-xl" align="start">
                                        <div className="grid grid-cols-4 gap-2">
                                            {COLORS.map((color) => (
                                                <div
                                                    key={color.name}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleUpdateColor(sub, color.name);
                                                    }}
                                                    className={cn(
                                                        "h-8 w-8 rounded-md cursor-pointer border border-transparent hover:scale-110 transition-all flex items-center justify-center",
                                                        color.pickerClass,
                                                        sub.color === color.name && "ring-2 ring-offset-2 ring-white dark:ring-gray-300"
                                                    )}
                                                />
                                            ))}
                                        </div>
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                {/* Active status indicator */}
                                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800">
                                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                                    <span className="text-xs font-medium text-green-700 dark:text-green-400">Activo</span>
                                </div>
                            </div>

                            {editingSubId === sub.id ? (
                                <Input
                                    value={tempSubName}
                                    onChange={(e) => setTempSubName(e.target.value)}
                                    className="text-xl font-bold text-gray-900 dark:text-white h-9 px-2 -ml-2 w-full bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                                    autoFocus
                                    onClick={(e) => e.stopPropagation()}
                                    onBlur={handleUpdateSubName}
                                    onKeyDown={(e) => e.key === 'Enter' && handleUpdateSubName()}
                                />
                            ) : (
                                <h3
                                    className="text-xl font-bold text-gray-900 dark:text-white hover:text-gray-600 dark:hover:text-gray-300 transition-colors w-fit cursor-text"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingSubId(sub.id);
                                        setTempSubName(sub.name);
                                    }}
                                >
                                    {sub.name}
                                </h3>
                            )}
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Gestiona campañas y contactos</p>
                        </div>

                        {/* Manage action link */}
                        <div className="relative z-10 mt-6 pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                            <span className="text-sm text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors">
                                Haz clic para gestionar
                            </span>
                            <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white group-hover:translate-x-1 transition-all" />
                        </div>
                    </div>
                ))}

                {subworkspaces.length === 0 && (
                    <div className="col-span-full py-12 text-center text-gray-400 dark:text-gray-500 border-dashed border-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                        <p>No hay agentes creados. Crea uno para empezar a llamar.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
