"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { Mic, Phone, PhoneOff } from "lucide-react";
import { RetellWebClient } from "retell-client-js-sdk";

type OrbState = "idle" | "connecting" | "listening";

import { AnalysisConfig } from "@/types/campaign";

interface VoiceOrbProps {
    agentId: string;
    prompt?: string;
    className?: string;
    analysisConfig?: AnalysisConfig;
}

export function VoiceOrb({ agentId, prompt, className = "", analysisConfig }: VoiceOrbProps) {
    const [state, setState] = useState<OrbState>("idle");
    const [timer, setTimer] = useState(0);
    const webClientRef = useRef<RetellWebClient | null>(null);
    const isCallingRef = useRef(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Timer for listening state
    useEffect(() => {
        if (state === "listening") {
            setTimer(0);
            intervalRef.current = setInterval(() => setTimer((t) => t + 1), 1000);
        } else if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [state]);

    const startRetellCall = useCallback(async () => {
        if (isCallingRef.current || !agentId) return;
        isCallingRef.current = true;
        setState("connecting");



        // Initialize Retell client
        const client = new RetellWebClient();

        client.on("call_started", () => {
            console.log("✅ Retell call started");
            setState("listening");
        });

        client.on("call_ended", () => {
            console.log("⏹️ Retell call ended");
            setState("idle");
            isCallingRef.current = false;
        });

        client.on("error", (err) => {
            console.error("❌ Retell error:", err);
            alert("Error de Retell: verifica conexión y permisos.");
            setState("idle");
            isCallingRef.current = false;
        });

        webClientRef.current = client;

        // Start call
        try {
            console.log("🔌 Fetching access token for agent:", agentId);
            const res = await fetch("/api/retell/create-web-call", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    agent_id: agentId,
                    prompt: prompt,
                    analysis_config: analysisConfig
                }),
            });

            if (!res.ok) {
                throw new Error(`API error: ${res.status}`);
            }

            const data = await res.json();
            console.log("🎫 Access token received, starting call...");

            await client.startCall({
                accessToken: data.access_token,
                sampleRate: 24000,
                emitRawAudioSamples: false,
            });

            console.log("📞 startCall completed");
        } catch (err) {
            console.error("❌ Error starting Retell call:", err);
            alert("Error al iniciar la llamada: comprueba tu conexión.");
            setState("idle");
            isCallingRef.current = false;
        }
    }, [agentId, prompt, analysisConfig]);

    const handleClick = () => {
        if (webClientRef.current && state === "listening") {
            webClientRef.current.stopCall();
            isCallingRef.current = false;
            setState("idle");
        } else if (state === "idle") {
            startRetellCall();
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    };

    return (
        <div className={`flex flex-col items-center ${className}`}>
            {/* Voice Orb Button */}
            <button
                type="button"
                onClick={handleClick}
                disabled={state === "connecting"}
                className={`
                    relative group
                    w-32 h-32 rounded-full
                    flex items-center justify-center
                    transition-all duration-300 ease-out
                    focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/50
                    ${state === "idle"
                        ? "bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 hover:scale-105 shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40"
                        : state === "connecting"
                            ? "bg-gradient-to-br from-yellow-500 to-orange-500 animate-pulse cursor-wait"
                            : "bg-gradient-to-br from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 shadow-lg shadow-red-500/30"
                    }
                `}
            >
                {/* Passive ring when listening (no pulse) */}
                {state === "listening" && (
                    <span className="absolute inset-[-4px] rounded-full border-2 border-red-500/30" />
                )}

                {/* Icon */}
                {state === "listening" ? (
                    <PhoneOff className="w-12 h-12 text-white drop-shadow-lg" />
                ) : state === "connecting" ? (
                    <Phone className="w-12 h-12 text-white drop-shadow-lg animate-bounce" />
                ) : (
                    <Mic className="w-12 h-12 text-white drop-shadow-lg group-hover:scale-110 transition-transform" />
                )}
            </button>

            {/* Status Text */}
            <p className="mt-4 text-center text-sm font-medium text-gray-600 dark:text-gray-400">
                {state === "connecting" ? (
                    "Conectando con el agente..."
                ) : state === "listening" ? (
                    <span className="text-red-500 dark:text-red-400 font-mono">
                        {formatTime(timer)}
                    </span>
                ) : (
                    "Pulsa para probar el agente"
                )}
            </p>
        </div>
    );
}
