"use client";

import { useEffect, useState, useRef, useLayoutEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import { CampaignList } from "@/components/campaigns/CampaignList";
import { CampaignDetail } from "@/components/campaigns/CampaignDetail";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Settings, FlaskConical, Pencil, Check, X, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TestingEnvironment } from "@/components/TestingEnvironment";
import { CallHistoryTable } from "@/components/calls/CallHistoryTable";
import { StatsDashboard } from "@/components/stats/StatsDashboard";
import { BarChart3 } from "lucide-react";

export default function SubworkspacePage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const subId = params.subId as string;

    // Get initial tab from URL or default to 'contacts'
    const initialTab = searchParams.get("tab") || "contacts";

    const [subName, setSubName] = useState("");
    const [agentId, setAgentId] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [activeTab, setActiveTab] = useState(initialTab);
    const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

    // Track scroll positions for each tab
    const scrollPositions = useRef<Record<string, number>>({});

    // Sync state with URL if URL changes (e.g. back button)
    useEffect(() => {
        const currentTab = searchParams.get("tab");
        if (currentTab && currentTab !== activeTab) {
            setActiveTab(currentTab);
        }
    }, [searchParams]);

    // Restore scroll position when tab changes
    useLayoutEffect(() => {
        const savedPosition = scrollPositions.current[activeTab] || 0;
        // Restore scroll on main window or specific container if needed
        // Since layout has overflow-y-auto on main, we need to find that element?
        // Actually the layout shows main has overflow-y-auto. Window scroll might be 0.
        // Let's try to target the main element.
        const main = document.querySelector('main');
        if (main) {
            main.scrollTop = savedPosition;
        } else {
            window.scrollTo(0, savedPosition);
        }
    }, [activeTab]);

    const handleTabChange = (value: string) => {
        // Save current scroll position before changing
        const main = document.querySelector('main');
        const currentScroll = main ? main.scrollTop : window.scrollY;
        scrollPositions.current[activeTab] = currentScroll;

        setActiveTab(value);
        // Update URL without reloading
        const newParams = new URLSearchParams(searchParams.toString());
        newParams.set("tab", value);
        router.push(`?${newParams.toString()}`);
    };

    const handleSaveName = async () => {
        if (!subName.trim()) return;
        try {
            await updateDoc(doc(db, "subworkspaces", subId), {
                name: subName
            });
            setIsEditing(false);
        } catch (error) {
            console.error("Error updating name:", error);
        }
    };

    useEffect(() => {
        async function fetchSub() {
            if (!subId) return;
            const snap = await getDoc(doc(db, "subworkspaces", subId));
            if (snap.exists()) {
                const data = snap.data();
                setSubName(data.name);
                setAgentId(data.retell_agent_id);
            }
        }
        fetchSub();
    }, [subId]);

    return (
        <div className="flex flex-col gap-6">
            {!selectedCampaignId && (
                <div className="flex flex-col gap-2">
                    <Link
                        href="/workspaces"
                        className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors flex items-center gap-2 w-fit px-2 py-1 -ml-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                        ←&nbsp; Volver a Workspaces
                    </Link>
                    <div className="flex items-center gap-2">
                        {isEditing ? (
                            <div className="flex items-center gap-2">
                                <Input
                                    value={subName}
                                    onChange={(e) => setSubName(e.target.value)}
                                    className="text-3xl font-bold h-12 w-[400px] text-gray-900 dark:text-white dark:bg-gray-800 dark:border-gray-600"
                                    autoFocus
                                    onBlur={handleSaveName}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                                />
                            </div>
                        ) : (
                            <div
                                className="flex items-center gap-3 group cursor-pointer"
                                onClick={() => setIsEditing(true)}
                            >
                                <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors">
                                    {subName || "Cargando Agente..."}
                                </h1>
                                <Pencil className="h-5 w-5 text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        )}
                    </div>
                </div>
            )}

            {selectedCampaignId ? (
                // Campaign Detail View
                <CampaignDetail
                    campaignId={selectedCampaignId}
                    subworkspaceId={subId}
                    onBack={() => setSelectedCampaignId(null)}
                />
            ) : (
                // Tabs containing Campaign List
                <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                    <TabsList className="grid w-full max-w-[800px] grid-cols-4 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                        <TabsTrigger
                            value="contacts"
                            className="gap-2 text-gray-900 dark:text-gray-300 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-gray-900 dark:data-[state=active]:text-white data-[state=active]:shadow-sm transition-all"
                        >
                            <Users className="h-4 w-4" /> Campañas
                        </TabsTrigger>
                        <TabsTrigger
                            value="test"
                            className="gap-2 text-gray-900 dark:text-gray-300 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-gray-900 dark:data-[state=active]:text-white data-[state=active]:shadow-sm transition-all"
                        >
                            <FlaskConical className="h-4 w-4" /> Entorno de Pruebas
                        </TabsTrigger>
                        <TabsTrigger
                            value="history"
                            className="gap-2 text-gray-900 dark:text-gray-300 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-gray-900 dark:data-[state=active]:text-white data-[state=active]:shadow-sm transition-all"
                        >
                            <History className="h-4 w-4" /> Historial
                        </TabsTrigger>
                        <TabsTrigger
                            value="stats"
                            className="gap-2 text-gray-900 dark:text-gray-300 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-gray-900 dark:data-[state=active]:text-white data-[state=active]:shadow-sm transition-all"
                        >
                            <BarChart3 className="h-4 w-4" /> Estadísticas
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="contacts" forceMount className="mt-6 data-[state=inactive]:hidden">
                        <CampaignList
                            subworkspaceId={subId}
                            onSelectCampaign={setSelectedCampaignId}
                        />
                    </TabsContent>

                    <TabsContent value="test" forceMount className="mt-6 data-[state=inactive]:hidden">
                        <TestingEnvironment subworkspaceId={subId} />
                    </TabsContent>

                    <TabsContent value="history" forceMount className="mt-6 data-[state=inactive]:hidden">
                        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-6">
                            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Historial de Llamadas</h2>
                            {agentId ? (
                                <CallHistoryTable agentId={agentId} />
                            ) : (
                                <div className="text-center py-10 text-gray-500">Cargando agente...</div>
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="stats" forceMount className="mt-6 data-[state=inactive]:hidden">
                        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-6">
                            {agentId ? (
                                <StatsDashboard agentId={agentId} subworkspaceId={subId} />
                            ) : (
                                <div className="text-center py-10 text-gray-500">Cargando agente...</div>
                            )}
                        </div>
                    </TabsContent>
                </Tabs>
            )}
        </div>
    );
}
