"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import {
    LayoutDashboard,
    Users,
    Settings,
    LogOut,
    Plus,
    Box,
    Moon,
    Sun,
    BarChart2,
    History,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export function Sidebar() {
    const pathname = usePathname();
    const { user, logout } = useAuth();
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    // Prevent hydration mismatch
    useEffect(() => {
        setMounted(true);
    }, []);

    const navItems = [

        {
            label: "Workspaces",
            href: "/workspaces",
            icon: Users, // Changed icon to Users for Agents
        },
        {
            label: "Settings",
            href: "/settings",
            icon: Settings,
        },
        {
            label: "Global Stats",
            href: "/global-stats",
            icon: BarChart2,
        },
        {
            label: "Global History",
            href: "/global-history",
            icon: History,
        },
    ];

    return (
        <div className="flex h-screen w-64 flex-col border-r bg-gray-50/40 dark:bg-gray-900/40 border-gray-200 dark:border-white/5 text-sm">
            <div className="flex h-14 items-center border-b border-gray-200 dark:border-white/5 px-4 lg:h-[60px]">
                <Link href="/" className="flex items-center gap-2 font-semibold">
                    <span className="text-lg tracking-tight text-gray-900 dark:text-white">VoiceCRM</span>
                </Link>
            </div>

            <div className="flex-1 overflow-auto py-4">
                <nav className="grid gap-1 px-2 text-gray-500 dark:text-gray-400 font-medium">
                    {navItems.map((item, index) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={index}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-3 rounded-md px-3 py-2 transition-all duration-200 ease-in-out hover:text-gray-900 dark:hover:text-white",
                                    isActive ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white translate-x-1" : "hover:bg-gray-100/50 dark:hover:bg-gray-800/50 hover:translate-x-1"
                                )}
                            >
                                <item.icon className="h-4 w-4" />
                                {item.label === "Agents" ? "Agentes" :
                                    item.label === "Settings" ? "Configuración" :
                                        item.label === "Global Stats" ? "Estadísticas Globales" :
                                            item.label === "Global History" ? "Historial Global" :
                                                item.label}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            <div className="border-t border-gray-200 dark:border-white/5 p-4">
                <div className="flex items-center gap-3 mb-4">
                    <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs text-gray-600 dark:text-gray-300 font-bold overflow-hidden">
                        {user?.photoURL ? (
                            <img src={user.photoURL} alt="User" />
                        ) : (
                            user?.email?.substring(0, 2).toUpperCase()
                        )}
                    </div>
                    <div className="flex flex-col overflow-hidden">
                        <span className="truncate text-xs font-semibold text-gray-900 dark:text-white">{user?.displayName || "User"}</span>
                        <span className="truncate text-[10px] text-gray-500 dark:text-gray-400">{user?.email}</span>
                    </div>
                </div>

                {/* Theme Toggle Button */}
                <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-1"
                    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                >
                    {mounted ? (
                        theme === "dark" ? (
                            <>
                                <Sun className="mr-2 h-4 w-4" />
                                Modo Claro
                            </>
                        ) : (
                            <>
                                <Moon className="mr-2 h-4 w-4" />
                                Modo Oscuro
                            </>
                        )
                    ) : (
                        <>
                            <Moon className="mr-2 h-4 w-4" />
                            Modo Oscuro
                        </>
                    )}
                </Button>

                <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-500"
                    onClick={async () => {
                        await logout();
                        window.location.href = "/";
                    }}
                >
                    <LogOut className="mr-2 h-4 w-4" />
                    Cerrar Sesión
                </Button>
            </div>
        </div>
    );
}

