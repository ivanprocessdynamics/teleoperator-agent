"use client";

import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Campaign, CampaignRow } from "@/types/campaign";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface CampaignDetailProps {
    campaignId: string;
    onBack: () => void;
}

export function CampaignDetail({ campaignId, onBack }: CampaignDetailProps) {
    // Placeholder component for now
    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={onBack}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex flex-col">
                    <h1 className="text-2xl font-bold text-gray-900">Detalle de Campaña</h1>
                    <p className="text-sm text-gray-500">ID: {campaignId}</p>
                </div>
            </div>

            <div className="flex items-center justify-center p-20 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
                <p className="text-gray-500">El editor de campañas se cargará aquí...</p>
            </div>
        </div>
    );
}
