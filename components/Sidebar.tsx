"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
    LayoutDashboard,
    Users,
    Settings,
    LogOut,
    Plus,
    Box,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export function Sidebar() {
    const pathname = usePathname();
    const { user, logout } = useAuth();

    const navItems = [
        {
            label: "Dashboard",
            href: "/dashboard",
            icon: LayoutDashboard,
        },
        {
            label: "Agents",
            href: "/agents",
            icon: Users, // Changed icon to Users for Agents
        },
        {
            label: "Settings",
            href: "/settings",
            icon: Settings,
        },
    ];

    return (
        <div className="flex h-screen w-64 flex-col border-r bg-gray-50/40 text-sm">
            <div className="flex h-14 items-center border-b px-4 lg:h-[60px]">
                <Link href="/" className="flex items-center gap-2 font-semibold">
                    <span className="text-lg tracking-tight text-gray-900">VoiceCRM</span>
                </Link>
            </div>

            <div className="flex-1 overflow-auto py-4">
                <nav className="grid gap-1 px-2 text-gray-500 font-medium">
                    {navItems.map((item, index) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={index}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-3 rounded-md px-3 py-2 transition-all hover:text-gray-900",
                                    isActive ? "bg-gray-100 text-gray-900" : "hover:bg-gray-100/50"
                                )}
                            >
                                <item.icon className="h-4 w-4" />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            <div className="border-t p-4">
                <div className="flex items-center gap-3 mb-4">
                    <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-600 font-bold overflow-hidden">
                        {user?.photoURL ? (
                            <img src={user.photoURL} alt="User" />
                        ) : (
                            user?.email?.substring(0, 2).toUpperCase()
                        )}
                    </div>
                    <div className="flex flex-col overflow-hidden">
                        <span className="truncate text-xs font-semibold text-gray-900">{user?.displayName || "User"}</span>
                        <span className="truncate text-[10px] text-gray-500">{user?.email}</span>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-gray-500 hover:text-red-600"
                    onClick={() => logout()}
                >
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                </Button>
            </div>
        </div>
    );
}
