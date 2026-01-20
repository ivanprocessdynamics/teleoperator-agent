"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import { CampaignList } from "@/components/campaigns/CampaignList";
import { CampaignDetail } from "@/components/campaigns/CampaignDetail";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mic, Users, Settings } from "lucide-react";

export default function SubworkspacePage() {
    const params = useParams();
    const subId = params.subId as string;
    const [subName, setSubName] = useState("");
    const [activeTab, setActiveTab] = useState("contacts");
    const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

    useEffect(() => {
        async function fetchName() {
            if (!subId) return;
            const snap = await getDoc(doc(db, "subworkspaces", subId));
            if (snap.exists()) {
                setSubName(snap.data().name);
            }
        }
        fetchName();
    }, [subId]);

    return (
        <div className="flex flex-col gap-6">
            {!selectedCampaignId && (
                <div className="flex flex-col gap-2">
                    <Link
                        href="/workspaces"
                        className="text-sm text-gray-500 hover:text-gray-900 transition-colors flex items-center gap-2 w-fit px-2 py-1 -ml-2 rounded-md hover:bg-gray-100"
                    >
                        ←&nbsp; Volver a Workspaces
                    </Link>
                    <div className="flex items-center justify-between">
                        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                            {subName || "Cargando Agente..."}
                        </h1>
                    </div>
                </div>
            )}

            {selectedCampaignId ? (
                // Campaign Detail View
                <CampaignDetail
                    campaignId={selectedCampaignId}
                    onBack={() => setSelectedCampaignId(null)}
                />
            ) : (
                // Tabs containing Campaign List
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full max-w-[400px] grid-cols-2 bg-gray-100 p-1 rounded-lg">
                        <TabsTrigger
                            value="contacts"
                            className="gap-2 data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm transition-all"
                        >
                            <Users className="h-4 w-4" /> Campañas
                        </TabsTrigger>
                        <TabsTrigger
                            value="test"
                            className="gap-2 data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm transition-all"
                        >
                            <Mic className="h-4 w-4" /> Configuración (Próximamente)
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="contacts" className="mt-6">
                        <CampaignList
                            subworkspaceId={subId}
                            onSelectCampaign={setSelectedCampaignId}
                        />
                    </TabsContent>

                    <TabsContent value="test" className="mt-6">
                        <div className="max-w-5xl mx-auto py-12 text-center">
                            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-12">
                                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100 mb-4">
                                    <Settings className="h-6 w-6 text-gray-400" />
                                </div>
                                <h3 className="text-lg font-medium text-gray-900">Configuración en desarrollo</h3>
                                <p className="text-sm text-gray-500 mt-2">Pronto podrás configurar el prompt y la voz de tu agente aquí.</p>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            )}
        </div>
    );
}
