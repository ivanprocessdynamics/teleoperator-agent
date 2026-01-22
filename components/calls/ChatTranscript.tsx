"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Pause, Download, User, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatMessage {
    role: "user" | "agent";
    content: string;
}

interface ChatTranscriptProps {
    messages: ChatMessage[];
    audioUrl?: string | null;
}

export function ChatTranscript({ messages, audioUrl }: ChatTranscriptProps) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const togglePlay = () => {
        if (!audioRef.current || !audioUrl) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
        }
    };

    const handleLoadedMetadata = () => {
        if (audioRef.current) {
            setDuration(audioRef.current.duration);
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (audioRef.current) {
            const time = parseFloat(e.target.value);
            audioRef.current.currentTime = time;
            setCurrentTime(time);
        }
    };

    const formatTime = (time: number) => {
        const mins = Math.floor(time / 60);
        const secs = Math.floor(time % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800">
            {/* Audio Player Header */}
            {audioUrl && (
                <div className="bg-white dark:bg-gray-800 p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col gap-3 shadow-sm z-10 w-full">
                    <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-3">
                            <Button
                                variant="default"
                                size="icon"
                                className="rounded-full h-10 w-10 bg-blue-600 hover:bg-blue-700 text-white shadow-md flex-shrink-0"
                                onClick={togglePlay}
                            >
                                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-1" />}
                            </Button>
                            <div className="flex flex-col">
                                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Grabación de la llamada
                                </div>
                                <div className="text-xs text-gray-500 font-mono">
                                    {formatTime(currentTime)} / {formatTime(duration)}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <a href={audioUrl} download target="_blank" rel="noopener noreferrer">
                                <Button variant="ghost" size="icon" className="text-gray-500 hover:text-gray-900 dark:hover:text-white">
                                    <Download className="h-5 w-5" />
                                </Button>
                            </a>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full flex items-center gap-3">
                        <input
                            type="range"
                            min="0"
                            max={duration || 100}
                            value={currentTime}
                            onChange={handleSeek}
                            className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-blue-600"
                        />
                    </div>

                    <audio
                        ref={audioRef}
                        src={audioUrl}
                        onEnded={() => setIsPlaying(false)}
                        onPause={() => setIsPlaying(false)}
                        onPlay={() => setIsPlaying(true)}
                        onTimeUpdate={handleTimeUpdate}
                        onLoadedMetadata={handleLoadedMetadata}
                        className="hidden"
                    />
                </div>
            )}

            {/* Chat Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {messages.length === 0 ? (
                    <div className="text-center text-gray-400 py-10">
                        No hay transcripción disponible
                    </div>
                ) : (
                    messages.map((msg, idx) => (
                        <div
                            key={idx}
                            className={cn(
                                "flex w-full items-end gap-2",
                                msg.role === "user" ? "justify-end" : "justify-start"
                            )}
                        >
                            {msg.role === "agent" && (
                                <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                                    <Bot className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                </div>
                            )}

                            <div className={cn(
                                "max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm",
                                msg.role === "user"
                                    ? "bg-blue-600 text-white rounded-br-none"
                                    : "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-100 dark:border-gray-700 rounded-bl-none"
                            )}>
                                {msg.content}
                            </div>

                            {msg.role === "user" && (
                                <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0">
                                    <User className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
