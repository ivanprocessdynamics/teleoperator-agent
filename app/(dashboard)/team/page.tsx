"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where, collectionGroup, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Loader2, Users, ArrowRight, Building2, Mail } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { CreateWorkspaceModal } from "@/components/CreateWorkspaceModal";
import { PendingInviteCard, PendingInvite } from "@/components/team/PendingInviteCard";

interface WorkspaceData {
    id: string;
    name: string;
    owner_uid: string;
    created_at?: any;
    memberCount?: number;
}

export default function TeamPage() {
    const { userData, user } = useAuth();
    const [workspaces, setWorkspaces] = useState<WorkspaceData[]>([]);
    const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        if (!userData || !user) return;
        fetchData();
    }, [userData, user]);

    const fetchData = async () => {
        try {
            setLoading(true);
            await Promise.all([fetchWorkspaces(), fetchPendingInvites()]);
        } catch (error) {
            console.error("Error fetching data:", error);
            toast.error("Error al cargar datos");
        } finally {
            setLoading(false);
        }
    };

    const fetchPendingInvites = async () => {
        if (!user?.email) return;

        try {
            // Query invites collection where email matches and status is pending
            const invitesQuery = query(
                collection(db, "invites"),
                where("email", "==", user.email.toLowerCase()),
                where("status", "==", "pending")
            );
            const invitesSnap = await getDocs(invitesQuery);

            const invites: PendingInvite[] = [];

            for (const inviteDoc of invitesSnap.docs) {
                const data = inviteDoc.data();
                let workspaceName = undefined;

                // Fetch workspace name if workspaceId exists
                if (data.workspaceId) {
                    try {
                        const wsDoc = await getDoc(doc(db, "workspaces", data.workspaceId));
                        if (wsDoc.exists()) {
                            workspaceName = wsDoc.data().name;
                        }
                    } catch (e) {
                        console.warn("Could not fetch workspace name:", e);
                    }
                }

                invites.push({
                    id: inviteDoc.id,
                    email: data.email,
                    role: data.role,
                    workspaceId: data.workspaceId,
                    workspaceName: workspaceName || data.workspaceName,
                    authorEmail: data.authorEmail,
                    authorName: data.authorName,
                    createdAt: data.createdAt,
                    status: data.status
                });
            }

            setPendingInvites(invites);
        } catch (error) {
            console.error("Error fetching pending invites:", error);
        }
    };

    const fetchWorkspaces = async () => {
        let workspacesList: WorkspaceData[] = [];

        if (userData?.role === 'superadmin') {
            // Super Admin sees ALL workspaces
            const querySnapshot = await getDocs(collection(db, "workspaces"));
            workspacesList = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as WorkspaceData));
        } else {
            // Regular admin/member sees workspaces they own OR are members of
            const workspaceMap = new Map<string, WorkspaceData>();

            // 1. First, get workspaces where user is OWNER
            const ownedQuery = query(
                collection(db, "workspaces"),
                where("owner_uid", "==", userData?.uid)
            );
            const ownedSnap = await getDocs(ownedQuery);
            for (const doc of ownedSnap.docs) {
                workspaceMap.set(doc.id, { id: doc.id, ...doc.data() } as WorkspaceData);
            }

            // 2. Then, get workspaces where user is MEMBER
            const membersQuery = query(collectionGroup(db, "members"), where("uid", "==", userData?.uid));
            const membersSnap = await getDocs(membersQuery);

            // Get workspace IDs from membership
            const workspaceIds = membersSnap.docs
                .map(doc => doc.ref.parent.parent?.id)
                .filter(Boolean) as string[];

            // Fetch workspace details for memberships (only those not already in map)
            const idsToFetch = workspaceIds.filter(id => !workspaceMap.has(id));

            if (idsToFetch.length > 0) {
                const promises = idsToFetch.map(async (wid) => {
                    const wsSnap = await getDocs(query(collection(db, "workspaces"), where("__name__", "==", wid)));
                    if (!wsSnap.empty) {
                        return { id: wsSnap.docs[0].id, ...wsSnap.docs[0].data() } as WorkspaceData;
                    }
                    return null;
                });

                const results = await Promise.all(promises);
                for (const ws of results) {
                    if (ws) workspaceMap.set(ws.id, ws);
                }
            }

            workspacesList = Array.from(workspaceMap.values());
        }

        setWorkspaces(workspacesList);
    };

    const handleInviteAccepted = () => {
        // Refresh data after accepting invite
        fetchData();
    };

    const handleInviteRejected = (inviteId: string) => {
        // Remove from local state
        setPendingInvites(prev => prev.filter(i => i.id !== inviteId));
    };

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Equipos</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-2">
                        Gestiona tus equipos y sus miembros.
                    </p>
                </div>
                {userData?.role === 'superadmin' && (
                    <CreateWorkspaceModal>
                        <Button>
                            <Building2 className="mr-2 h-4 w-4" />
                            Crear Equipo
                        </Button>
                    </CreateWorkspaceModal>
                )}
            </div>

            {/* Pending Invitations Section */}
            {pendingInvites.length > 0 && (
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <Mail className="h-5 w-5 text-amber-500" />
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Invitaciones Pendientes ({pendingInvites.length})
                        </h2>
                    </div>
                    <div className="space-y-3">
                        {pendingInvites.map((invite) => (
                            <PendingInviteCard
                                key={invite.id}
                                invite={invite}
                                onAccept={handleInviteAccepted}
                                onReject={() => handleInviteRejected(invite.id)}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Workspaces Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {workspaces.map((ws) => (
                    <div
                        key={ws.id}
                        onClick={() => router.push(`/team/${ws.id}`)}
                        className="group relative flex flex-col justify-between rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-6 shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden"
                    >
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                    <Users className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900 dark:text-white text-lg group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                        {ws.name}
                                    </h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        ID: {ws.id.substring(0, 8)}...
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 flex items-center justify-between border-t border-gray-100 dark:border-gray-800 pt-4">
                            <span className="text-sm font-medium text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-200 transition-colors">
                                Ver miembros
                            </span>
                            <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:translate-x-1 transition-transform" />
                        </div>
                    </div>
                ))}

                {workspaces.length === 0 && (
                    <div className="col-span-full py-12 text-center text-gray-400 dark:text-gray-500 border-dashed border-2 border-gray-300 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-900/50">
                        <Users className="mx-auto h-12 w-12 opacity-50 mb-3" />
                        <p>No perteneces a ningún equipo.</p>
                        {userData?.role === 'superadmin' && (
                            <p className="text-sm mt-1">Crea uno nuevo para empezar.</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
