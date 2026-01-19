"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ContactsGrid } from "@/components/ContactsGrid";
import { Playground } from "@/components/Playground";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mic, Users, Settings } from "lucide-react";

export default function SubworkspacePage() {
    const params = useParams();
    const subId = params.subId as string;
    const [subName, setSubName] = useState("");
    const [activeTab, setActiveTab] = useState("contacts");

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
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                    {subName || "Agent"}
                </h1>
                {/* Settings button could go here */}
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full max-w-[400px] grid-cols-2">
                    <TabsTrigger value="contacts" className="gap-2">
                        <Users className="h-4 w-4" /> Contacts
                    </TabsTrigger>
                    <TabsTrigger value="test" className="gap-2">
                        <Mic className="h-4 w-4" /> Test Agent
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="contacts" className="mt-6">
                    <ContactsGrid subworkspaceId={subId} />
                </TabsContent>

                <TabsContent value="test" className="mt-6">
                    <div className="max-w-5xl mx-auto">
                        <Playground subworkspaceId={subId} />
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
