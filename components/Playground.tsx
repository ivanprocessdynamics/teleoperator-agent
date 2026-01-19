"use client";

import { useEffect, useState, useRef } from "react";
import { RetellWebClient } from "retell-client-js-sdk";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, PhoneOff } from "lucide-react";
import { cn } from "@/lib/utils";

const retellWebClient = new RetellWebClient();

interface PlaygroundProps {
    subworkspaceId: string; // Used to fetch agent config/ID if needed, but for now we might need an Agent ID from Retell
}

export function Playground({ subworkspaceId }: PlaygroundProps) {
    const [isCalling, setIsCalling] = useState(false);
    const [transcript, setTranscript] = useState<{ role: 'user' | 'agent', content: string }[]>([]);
    const [activeSpeaker, setActiveSpeaker] = useState<'user' | 'agent' | null>(null);

    // Mock Agent ID for demo purposes if not passed or fetched
    // In real app, we would fetch the 'retell_agent_id' stored in subworkspace
    const agentId = "agent_123456";

    useEffect(() => {
        // Setup listeners
        retellWebClient.on("call_started", () => {
            console.log("Call started");
            setIsCalling(true);
        });

        retellWebClient.on("call_ended", () => {
            console.log("Call ended");
            setIsCalling(false);
            setActiveSpeaker(null);
        });

        retellWebClient.on("update", (update) => {
            // Handle transcript updates
            if (update.transcript) {
                // This is simplified, real event structure might differ
                // Assuming we get continuous updates or partials
                // For MVP, just pushing to log
                setTranscript(prev => [...prev, { role: update.role, content: update.content }]);
                setActiveSpeaker(update.role);
            }
        });

        retellWebClient.on("agent_start_talking", () => setActiveSpeaker('agent'));
        retellWebClient.on("agent_stop_talking", () => setActiveSpeaker(null));

        return () => {
            retellWebClient.stopCall(); // Cleanup
        };
    }, []);

    const toggleCall = async () => {
        if (isCalling) {
            await retellWebClient.stopCall();
            setIsCalling(false);
        } else {
            try {
                // We need an ephemeral key from our backend to start a web call
                // For now, we'll mock or failing that, assume we have the endpoint
                const response = await fetch("/api/retell/create-web-call", {
                    method: "POST",
                    body: JSON.stringify({ agent_id: agentId }) // In real app, subworkspace has the agent_id
                });

                if (!response.ok) throw new Error("Failed to get access token");

                const data = await response.json();
                await retellWebClient.startCall({
                    accessToken: data.access_token,
                });

            } catch (err) {
                console.error("Error starting call:", err);
                alert("Failed to start call. Ensure Backend API is set up with Retell Keys.");
            }
        }
    };

    return (
        <div className="flex h-[500px] gap-6">
            {/* Visualizer Area */}
            <div className="relative flex flex-1 flex-col items-center justify-center rounded-2xl bg-gray-950 p-8 shadow-inner overflow-hidden">
                {/* Background Glow */}
                <div className={cn(
                    "absolute h-64 w-64 rounded-full bg-blue-500/20 blur-3xl transition-all duration-1000",
                    activeSpeaker === 'agent' ? "scale-150 opacity-100" : "scale-100 opacity-50"
                )} />

                {/* Orb */}
                <div
                    className={cn(
                        "relative z-10 flex h-32 w-32 cursor-pointer items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 shadow-lg transition-all duration-500 hover:scale-105",
                        isCalling ? "animate-pulse" : "opacity-80",
                        activeSpeaker === 'agent' && "scale-110 shadow-blue-500/50"
                    )}
                    onClick={toggleCall}
                >
                    {isCalling ? (
                        <PhoneOff className="h-10 w-10 text-white" />
                    ) : (
                        <Mic className="h-10 w-10 text-white" />
                    )}
                </div>

                {/* Status Text */}
                <div className="mt-8 text-center">
                    <div className="text-xl font-medium text-white">
                        {isCalling ? (activeSpeaker === 'agent' ? "Agent Speaking..." : "Listening...") : "Tap to Speak"}
                    </div>
                    {isCalling && <div className="mt-2 text-sm text-gray-400 font-mono">00:15</div>}
                </div>
            </div>

            {/* Transcript / Debug Panel */}
            <div className="flex w-96 flex-col rounded-xl border bg-white shadow-sm">
                <div className="border-b px-4 py-3 font-medium bg-gray-50 text-gray-700">
                    Live Transcript
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {transcript.length === 0 ? (
                        <div className="text-center text-sm text-gray-400 mt-10">
                            Transcript will appear here...
                        </div>
                    ) : (
                        transcript.map((msg, i) => (
                            <div key={i} className={cn(
                                "flex flex-col text-sm max-w-[90%]",
                                msg.role === 'user' ? "self-end items-end ml-auto" : "self-start items-start"
                            )}>
                                <span className="text-[10px] text-gray-400 mb-1 uppercase tracking-wider">{msg.role}</span>
                                <div className={cn(
                                    "px-3 py-2 rounded-lg",
                                    msg.role === 'user' ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-800"
                                )}>
                                    {msg.content}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
