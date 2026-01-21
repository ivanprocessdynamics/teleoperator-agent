"use client";

import { useState, useEffect } from "react";
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, getDocs, writeBatch, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Campaign, CampaignRow } from "@/types/campaign";
import { Button } from "@/components/ui/button";
import { Plus, ArrowRight, PlayCircle, FileText, CheckCircle2, MoreVertical, Trash2, Copy, Phone, Users, Target, Zap, Star, MessageCircle, Mail, Megaphone, Globe } from "lucide-react";
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

const ICONS = [
    { name: 'FileText', icon: FileText },
    { name: 'Phone', icon: Phone },
    { name: 'Users', icon: Users },
    { name: 'Target', icon: Target },
    { name: 'Zap', icon: Zap },
    { name: 'Star', icon: Star },
    { name: 'MessageCircle', icon: MessageCircle },
    { name: 'Mail', icon: Mail },
];

const COLORS = [
    { name: 'gray', class: 'bg-gray-100 text-gray-600', hover: 'hover:bg-gray-200' },
    { name: 'blue', class: 'bg-blue-50 text-blue-600', hover: 'hover:bg-blue-100' },
    { name: 'green', class: 'bg-green-50 text-green-600', hover: 'hover:bg-green-100' },
    { name: 'yellow', class: 'bg-yellow-50 text-yellow-600', hover: 'hover:bg-yellow-100' },
    { name: 'red', class: 'bg-red-50 text-red-600', hover: 'hover:bg-red-100' },
    { name: 'purple', class: 'bg-purple-50 text-purple-600', hover: 'hover:bg-purple-100' },
    { name: 'pink', class: 'bg-pink-50 text-pink-600', hover: 'hover:bg-pink-100' },
    { name: 'orange', class: 'bg-orange-50 text-orange-600', hover: 'hover:bg-orange-100' },
];

function IconVisualSelector({
    icon,
    color,
    onChange
}: {
    icon: string;
    color: string;
    onChange: (icon: string, color: string) => void;
}) {
    const SelectedIcon = ICONS.find(i => i.name === icon)?.icon || FileText;
    const selectedColorClass = COLORS.find(c => c.name === color)?.class || COLORS[0].class;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <div
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                        "flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg transition-transform hover:scale-105 active:scale-95",
                        selectedColorClass
                    )}
                >
                    <SelectedIcon className="h-5 w-5" />
                </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64 p-3 bg-white border-gray-200" align="start">
                <div className="space-y-4">
                    <div>
                        <span className="text-xs font-semibold text-gray-500 uppercase mb-2 block">Icono</span>
                        <div className="grid grid-cols-4 gap-2">
                            {ICONS.map((item) => (
                                <div
                                    key={item.name}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onChange(item.name, color);
                                    }}
                                    className={cn(
                                        "flex items-center justify-center p-2 rounded-md hover:bg-gray-100 cursor-pointer transition-colors",
                                        icon === item.name && "bg-gray-100 ring-1 ring-gray-900"
                                    )}
                                >
                                    <item.icon className="h-4 w-4 text-gray-700" />
                                </div>
                            ))}
                        </div>
                    </div>
                    <div>
                        <span className="text-xs font-semibold text-gray-500 uppercase mb-2 block">Color</span>
                        <div className="grid grid-cols-4 gap-2">
                            {COLORS.map((item) => (
                                <div
                                    key={item.name}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onChange(icon, item.name);
                                    }}
                                    className={cn(
                                        "h-8 w-full rounded-md cursor-pointer border border-transparent hover:scale-105 transition-all flex items-center justify-center",
                                        item.class,
                                        color === item.name && "ring-1 ring-offset-1 ring-gray-900 border-gray-300"
                                    )}
                                >
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function CreateCampaignDialog({
    subworkspaceId,
    onSelectCampaign,
    trigger
}: {
    subworkspaceId: string,
    onSelectCampaign: (id: string) => void,
    trigger: React.ReactNode
}) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState("");
    const [selectedIcon, setSelectedIcon] = useState("FileText");
    const [selectedColor, setSelectedColor] = useState("gray");
    const [creating, setCreating] = useState(false);

    const handleCreate = async () => {
        if (!name.trim()) return;
        setCreating(true);

        try {
            const defaultColumns = Array.from({ length: 10 }).map((_, i) => ({
                id: `col_${Date.now()}_${i}`,
                key: `columna_${i + 1}`,
                label: `Columna ${i + 1}`
            }));

            const docRef = await addDoc(collection(db, "campaigns"), {
                subworkspace_id: subworkspaceId,
                name: name,
                icon: selectedIcon,
                color: selectedColor,
                status: 'draft',
                columns: defaultColumns,
                prompt_template: "",
                created_at: serverTimestamp(),
                updated_at: serverTimestamp()
            });

            setOpen(false);
            setName("");
            setSelectedIcon("FileText");
            setSelectedColor("gray");
            onSelectCampaign(docRef.id);
        } catch (error) {
            console.error("Error creating campaign:", error);
        } finally {
            setCreating(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger}
            </DialogTrigger>
            <DialogContent className="bg-white text-gray-900 border-gray-200 sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="text-gray-900">Crear Nueva Campaña</DialogTitle>
                </DialogHeader>
                <div className="py-4 gap-4 flex flex-col">
                    <div className="flex gap-3">
                        <IconVisualSelector
                            icon={selectedIcon}
                            color={selectedColor}
                            onChange={(i, c) => {
                                setSelectedIcon(i);
                                setSelectedColor(c);
                            }}
                        />
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                            className="bg-white border-gray-300 text-gray-900 focus-visible:ring-gray-900 flex-1"
                            autoFocus
                            placeholder="Nombre de la campaña"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setOpen(false)} className="text-gray-700 hover:bg-gray-100 hover:text-gray-900">Cancelar</Button>
                    <Button onClick={handleCreate} disabled={!name.trim() || creating} className="bg-gray-900 text-white hover:bg-gray-700">
                        {creating ? "Creando..." : "Crear"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function CampaignList({ subworkspaceId, onSelectCampaign }: CampaignListProps) {
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [loading, setLoading] = useState(true);

    // Delete confirmation dialog state
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [campaignToDelete, setCampaignToDelete] = useState<Campaign | null>(null);
    const [deleting, setDeleting] = useState(false);

    // Inline Editing State
    const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
    const [tempCampaignName, setTempCampaignName] = useState("");

    const handleUpdateCampaignName = async () => {
        if (!editingCampaignId || !tempCampaignName.trim()) {
            setEditingCampaignId(null);
            return;
        }

        const campId = editingCampaignId;
        const newName = tempCampaignName;

        // Optimistic update
        setCampaigns(prev => prev.map(c => c.id === campId ? { ...c, name: newName } : c));
        setEditingCampaignId(null);

        try {
            await updateDoc(doc(db, "campaigns", campId), { name: newName });
        } catch (error) {
            console.error("Error updating campaign name:", error);
        }
    };

    // Inline Editing State
    const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
    const [tempCampaignName, setTempCampaignName] = useState("");

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



    const openDeleteConfirmation = (e: React.MouseEvent, campaign: Campaign) => {
        e.stopPropagation(); // Prevent card click
        setCampaignToDelete(campaign);
        setIsDeleteOpen(true);
    };

    const handleDeleteCampaign = async () => {
        if (!campaignToDelete) return;
        setDeleting(true);

        try {
            // 1. Delete rows (batch)
            const rowsQ = query(collection(db, "campaign_rows"), where("campaign_id", "==", campaignToDelete.id));
            const rowsSnap = await getDocs(rowsQ);

            const batch = writeBatch(db);
            rowsSnap.docs.forEach((docSnap) => {
                batch.delete(docSnap.ref);
            });

            // 2. Delete campaign
            batch.delete(doc(db, "campaigns", campaignToDelete.id));

            await batch.commit();
            setIsDeleteOpen(false);
            setCampaignToDelete(null);
        } catch (error) {
            console.error("Error deleting campaign:", error);
        } finally {
            setDeleting(false);
        }
    };

    const handleUpdateVisuals = async (campaignId: string, icon: string, color: string) => {
        try {
            await updateDoc(doc(db, "campaigns", campaignId), {
                icon,
                color
            });
        } catch (error) {
            console.error("Error updating visuals:", error);
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

    // Show skeleton while loading
    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="space-y-2">
                        <div className="h-6 w-32 rounded bg-gray-200 animate-skeleton" />
                        <div className="h-4 w-64 rounded bg-gray-200 animate-skeleton" />
                    </div>
                    <div className="h-10 w-36 rounded bg-gray-200 animate-skeleton" />
                </div>
                <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="rounded-xl border border-gray-200 p-5 flex items-center gap-4">
                            <div className="h-10 w-10 rounded bg-gray-200 animate-skeleton" />
                            <div className="space-y-2 flex-1">
                                <div className="h-5 w-1/3 rounded bg-gray-200 animate-skeleton" />
                                <div className="h-3 w-1/4 rounded bg-gray-200 animate-skeleton" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Campañas</h2>
                        <p className="text-sm text-gray-500">Crea campañas, define variables y lanza llamadas.</p>
                    </div>

                    <CreateCampaignDialog
                        subworkspaceId={subworkspaceId}
                        onSelectCampaign={onSelectCampaign}
                        trigger={
                            <Button className="bg-gray-900 text-white hover:bg-black">
                                <Plus className="mr-2 h-4 w-4" /> Nueva Campaña
                            </Button>
                        }
                    />
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
                        <CreateCampaignDialog
                            subworkspaceId={subworkspaceId}
                            onSelectCampaign={onSelectCampaign}
                            trigger={
                                <Button variant="outline">
                                    Crear Campaña
                                </Button>
                            }
                        />
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
                                            <IconVisualSelector
                                                icon={camp.icon || 'FileText'}
                                                color={camp.color || 'gray'}
                                                onChange={(i, c) => handleUpdateVisuals(camp.id, i, c)}
                                            />
                                            <div className="flex-1 min-w-0">
                                                {editingCampaignId === camp.id ? (
                                                    <Input
                                                        value={tempCampaignName}
                                                        onChange={(e) => setTempCampaignName(e.target.value)}
                                                        className="font-semibold text-gray-900 h-7 px-1 -ml-1 text-base w-full bg-white border-gray-300"
                                                        autoFocus
                                                        onClick={(e) => e.stopPropagation()}
                                                        onBlur={handleUpdateCampaignName}
                                                        onKeyDown={(e) => e.key === 'Enter' && handleUpdateCampaignName()}
                                                    />
                                                ) : (
                                                    <h3
                                                        className="font-semibold text-gray-900 line-clamp-1 hover:text-gray-600 transition-colors w-fit max-w-full truncate"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setEditingCampaignId(camp.id);
                                                            setTempCampaignName(camp.name);
                                                        }}
                                                    >
                                                        {camp.name}
                                                    </h3>
                                                )}
                                                <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 mt-1",
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
                                                <DropdownMenuItem onClick={(e) => handleDuplicateCampaign(e, camp)} className="text-gray-900 focus:text-gray-900">
                                                    <Copy className="mr-2 h-4 w-4" /> Duplicar
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={(e) => openDeleteConfirmation(e, camp)} className="text-red-600 focus:text-red-600">
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
                        <DialogTitle className="text-gray-900">Confirmar Eliminación</DialogTitle>
                        <DialogDescription className="text-gray-500 pt-2">
                            ¿Estás seguro de eliminar <span className="font-bold text-gray-900">{campaignToDelete?.name}</span>? Esta acción no se puede deshacer.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0 mt-4">
                        <Button
                            variant="outline"
                            onClick={() => setIsDeleteOpen(false)}
                            className="bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleDeleteCampaign}
                            disabled={deleting}
                            className="bg-red-600 text-white hover:bg-red-700 hover:scale-105 transition-all"
                        >
                            {deleting ? "Eliminando..." : "Confirmar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
