"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Campaign, CampaignColumn } from "@/types/campaign";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Play } from "lucide-react";
import { CampaignTable } from "./CampaignTable";
import { CampaignPrompt } from "./CampaignPrompt";
import { Input } from "@/components/ui/input";

interface CampaignDetailProps {
    campaignId: string;
    onBack: () => void;
}

export function CampaignDetail({ campaignId, onBack }: CampaignDetailProps) {
    const [campaign, setCampaign] = useState<Campaign | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!campaignId) return;
        const unsub = onSnapshot(doc(db, "campaigns", campaignId), (doc) => {
            if (doc.exists()) {
                setCampaign({ id: doc.id, ...doc.data() } as Campaign);
            }
            setLoading(false);
        });
        return () => unsub();
    }, [campaignId]);

    const handleUpdateColumns = async (newCols: CampaignColumn[]) => {
        if (!campaign) return;
        await updateDoc(doc(db, "campaigns", campaign.id), {
            columns: newCols
        });
    };

    const handleUpdatePrompt = async (newPrompt: string) => {
        if (!campaign) return;
        // Optimistic update local state to avoid jumpiness
        // setCampaign(prev => prev ? ({ ...prev, prompt_template: newPrompt }) : null);
        // Debounce could be good, but for now direct update
        await updateDoc(doc(db, "campaigns", campaign.id), {
            prompt_template: newPrompt
        });
    };

    const handleNameChange = async (newName: string) => {
        if (!campaign) return;
        await updateDoc(doc(db, "campaigns", campaign.id), {
            name: newName
        });
    };

    if (loading) return <div className="p-10 text-center text-gray-500">Cargando editor...</div>;
    if (!campaign) return <div className="p-10 text-center text-red-500">Campaña no encontrada</div>;

    return (
        <div className="flex flex-col h-[calc(100vh-140px)] gap-4">
            {/* Header */}
            <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={onBack}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <Input
                        value={campaign.name}
                        onChange={(e) => handleNameChange(e.target.value)}
                        className="text-xl font-bold text-gray-900 border-none px-0 h-auto focus-visible:ring-0 bg-transparent w-[300px]"
                    />
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                        {campaign.status}
                    </span>
                </div>
                <div className="flex gap-2">
                    <Button className="bg-gray-900 text-white hover:bg-black shadow-sm">
                        <Play className="mr-2 h-4 w-4" /> Lanzar Campaña
                    </Button>
                </div>
            </div>

            {/* Main Split View */}
            <div className="flex-1 grid grid-cols-12 gap-6 min-h-0">
                {/* Left: Table Editor (7 cols) */}
                <div className="col-span-7 h-full flex flex-col">
                    <CampaignTable
                        campaign={campaign}
                        onColumnsChange={handleUpdateColumns}
                    />
                </div>

                {/* Right: Prompt Editor (5 cols) */}
                <div className="col-span-5 h-full flex flex-col">
                    <CampaignPrompt
                        prompt={campaign.prompt_template || ""}
                        columns={campaign.columns || []}
                        onChange={handleUpdatePrompt}
                    />
                </div>
            </div>
        </div>
    );
}
