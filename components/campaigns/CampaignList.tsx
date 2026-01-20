"use client";

import { useState, useEffect } from "react";
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, getDocs, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Campaign, CampaignRow } from "@/types/campaign";
import { Button } from "@/components/ui/button";
import { Plus, ArrowRight, PlayCircle, FileText, CheckCircle2, MoreVertical, Trash2, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CampaignListProps {
    subworkspaceId: string;
    onSelectCampaign: (campaignId: string) => void;
}

export function CampaignList({ subworkspaceId, onSelectCampaign }: CampaignListProps) {
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newCampaignName, setNewCampaignName] = useState("");
    const [creating, setCreating] = useState(false);

    // Delete confirmation dialog state
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [campaignToDelete, setCampaignToDelete] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        if (!subworkspaceId) return;

        // Query without orderBy to avoid index requirement
        // Sorting is done client-side instead
        const q = query(
            collection(db, "campaigns"),
            where("subworkspace_id", "==", subworkspaceId)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetched: Campaign[] = [];
            snapshot.forEach((doc) => {
                fetched.push({ id: doc.id, ...doc.data() } as Campaign);
            });
            // Sort client-side by created_at (descending)
            fetched.sort((a, b) => {
                const dateA = a.created_at?.toDate?.() || new Date(0);
                const dateB = b.created_at?.toDate?.() || new Date(0);
                return dateB.getTime() - dateA.getTime();
            });
            setCampaigns(fetched);
            setLoading(false);
        }, (error) => {
            console.error("Error loading campaigns:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [subworkspaceId]);

    const handleCreateCampaign = async () => {
        if (!newCampaignName.trim()) return;
        setCreating(true);

        try {
            // Initialize with 10 default columns
            const defaultColumns = Array.from({ length: 10 }).map((_, i) => ({
                id: `col_${Date.now()}_${i}`,
                key: `columna_${i + 1}`,
                label: `Columna ${i + 1}`
            }));

            const docRef = await addDoc(collection(db, "campaigns"), {
                subworkspace_id: subworkspaceId,
                name: newCampaignName,
                status: 'draft',
                columns: defaultColumns,
                prompt_template: "",
                created_at: serverTimestamp(),
                updated_at: serverTimestamp()
            });

            setIsCreateOpen(false);
            setNewCampaignName("");
            onSelectCampaign(docRef.id); // Auto-open new campaign
        } catch (error) {
            console.error("Error creating campaign:", error);
        } finally {
            setCreating(false);
        }
    };

    const openDeleteConfirmation = (e: React.MouseEvent, campaignId: string) => {
        e.stopPropagation(); // Prevent card click
        setCampaignToDelete(campaignId);
        setIsDeleteOpen(true);
    };

    const handleDeleteCampaign = async () => {
        if (!campaignToDelete) return;
        setDeleting(true);

        try {
            // 1. Delete rows (batch)
            const rowsQ = query(collection(db, "campaign_rows"), where("campaign_id", "==", campaignToDelete));
            const rowsSnap = await getDocs(rowsQ);

            const batch = writeBatch(db);
            rowsSnap.docs.forEach((docSnap) => {
                batch.delete(docSnap.ref);
            });

            // 2. Delete campaign
            batch.delete(doc(db, "campaigns", campaignToDelete));

            await batch.commit();
            setIsDeleteOpen(false);
            setCampaignToDelete(null);
        } catch (error) {
            console.error("Error deleting campaign:", error);
        } finally {
            setDeleting(false);
        }
    };

    const handleDuplicateCampaign = async (e: React.MouseEvent, campaign: Campaign) => {
        e.stopPropagation();

        try {
            const newName = `${campaign.name} (Copia)`;

            // 1. Create new campaign doc
            const newCampaignRef = await addDoc(collection(db, "campaigns"), {
                ...campaign,
                name: newName,
                status: 'draft',
                created_at: serverTimestamp(),
                updated_at: serverTimestamp(),
                // Exclude ID from spread
            });

            // 2. Copy rows (Optional: limit to avoiding massive writes if user has 10k rows? 
            // For now, let's copy them as the user expects a duplicate)
            const rowsQ = query(collection(db, "campaign_rows"), where("campaign_id", "==", campaign.id));
            const rowsSnap = await getDocs(rowsQ);

            // Batch writes (chunks of 500)
            const chunks = [];
            let currentBatch = writeBatch(db);
            let count = 0;

            rowsSnap.docs.forEach((rowDoc) => {
                const rowData = rowDoc.data();
                const newRowRef = doc(collection(db, "campaign_rows"));
                currentBatch.set(newRowRef, {
                    ...rowData,
                    campaign_id: newCampaignRef.id,
                    status: 'pending' // Reset status for fresh runs
                });

                count++;
                if (count >= 490) {
                    chunks.push(currentBatch.commit());
                    currentBatch = writeBatch(db);
                    count = 0;
                }
            });
            if (count > 0) chunks.push(currentBatch.commit());

            await Promise.all(chunks);

        } catch (error) {
            console.error("Error duplicating campaign:", error);
            alert("Error al duplicar la campaña.");
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'running': return <PlayCircle className="h-5 w-5 text-blue-600" />;
            case 'completed': return <CheckCircle2 className="h-5 w-5 text-green-600" />;
            case 'draft':
            default: return <FileText className="h-5 w-5 text-gray-400" />;
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'running': return "En Progreso";
            case 'completed': return "Finalizada";
            case 'draft': return "Borrador";
            default: return status;
        }
    };

    return (
        <>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Campañas</h2>
                        <p className="text-sm text-gray-500">Crea campañas, define variables y lanza llamadas.</p>
                    </div>

                    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-gray-900 text-white hover:bg-black">
                                <Plus className="mr-2 h-4 w-4" /> Nueva Campaña
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-white text-gray-900 border-gray-200 sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle className="text-gray-900">Crear Nueva Campaña</DialogTitle>
                            </DialogHeader>
                            <div className="py-4">
                                <Input
                                    placeholder="Nombre de la campaña (ej. Ventas Enero)"
                                    value={newCampaignName}
                                    onChange={(e) => setNewCampaignName(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleCreateCampaign()}
                                    className="bg-white border-gray-200 text-gray-900 placeholder:text-gray-500 focus-visible:ring-gray-900"
                                />
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsCreateOpen(false)} className="border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-900">Cancelar</Button>
                                <Button onClick={handleCreateCampaign} disabled={!newCampaignName.trim() || creating} className="bg-gray-900 text-white hover:bg-black">
                                    {creating ? "Creando..." : "Crear"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                {loading ? (
                    <div className="text-center py-10 text-gray-400">Cargando campañas...</div>
                ) : campaigns.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center bg-gray-50/50">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400 mb-4">
                            <FileText className="h-6 w-6" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900">No hay campañas</h3>
                        <p className="text-sm text-gray-500 mt-1 mb-6">Empieza creando tu primera campaña de llamadas.</p>
                        <Button variant="outline" onClick={() => setIsCreateOpen(true)}>
                            Crear Campaña
                        </Button>
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {campaigns.map((camp) => (
                            <div
                                key={camp.id}
                                onClick={() => onSelectCampaign(camp.id)}
                                className="group relative cursor-pointer flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-gray-300"
                            >
                                <div className="space-y-4">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg bg-gray-50 transition-colors group-hover:bg-gray-100",
                                                camp.status === 'running' && "bg-blue-50 text-blue-600 group-hover:bg-blue-100"
                                            )}>
                                                {getStatusIcon(camp.status)}
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-gray-900 line-clamp-1">{camp.name}</h3>
                                                <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600",
                                                    camp.status === 'running' && "bg-blue-100 text-blue-700",
                                                    camp.status === 'completed' && "bg-green-100 text-green-700"
                                                )}>
                                                    {getStatusLabel(camp.status)}
                                                </span>
                                            </div>
                                        </div>

                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 -mr-2 text-gray-400 hover:text-gray-700"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-[160px]">
                                                <DropdownMenuItem onClick={(e) => handleDuplicateCampaign(e, camp)}>
                                                    <Copy className="mr-2 h-4 w-4" /> Duplicar
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={(e) => openDeleteConfirmation(e, camp.id)} className="text-red-600 focus:text-red-600">
                                                    <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>

                                    <div className="space-y-1">
                                        <p className="text-xs text-gray-400">
                                            Creada el {camp.created_at?.toDate().toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-6 flex items-center text-sm font-medium text-gray-600 group-hover:text-gray-900">
                                    Gestionar <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Delete Confirmation Dialog */}
            <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <DialogContent className="bg-white text-gray-900 border-gray-200 sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="text-gray-900">Eliminar Campaña</DialogTitle>
                        <DialogDescription className="text-gray-500">
                            ¿Estás seguro de que quieres eliminar esta campaña? Se borrarán todos los datos asociados. Esta acción no se puede deshacer.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            variant="outline"
                            onClick={() => setIsDeleteOpen(false)}
                            className="border-gray-200 text-gray-700 hover:bg-gray-50"
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleDeleteCampaign}
                            disabled={deleting}
                            className="bg-red-600 text-white hover:bg-red-700"
                        >
                            {deleting ? "Eliminando..." : "Eliminar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
