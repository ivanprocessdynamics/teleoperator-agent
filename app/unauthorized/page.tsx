"use client";

import { Button } from "@/components/ui/button";
import { ShieldAlert, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

export default function UnauthorizedPage() {
    const { logout } = useAuth();
    const router = useRouter();

    const handleLogout = async () => {
        await logout();
        router.push("/");
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
            <div className="w-full max-w-md space-y-8 rounded-xl bg-white dark:bg-gray-800 p-10 shadow-xl border border-gray-100 dark:border-gray-700 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                    <ShieldAlert className="h-8 w-8" />
                </div>

                <div className="space-y-3">
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                        Acceso No Autorizado
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400">
                        Todavía no eres miembro de ningún equipo. Ponte en contacto con un administrador para que te invite.
                    </p>
                </div>

                <div className="pt-4">
                    <Button
                        onClick={handleLogout}
                        variant="outline"
                        className="w-full border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                        <LogOut className="mr-2 h-4 w-4" />
                        Volver al inicio
                    </Button>
                </div>
            </div>

            <p className="mt-8 text-center text-xs text-gray-400">
                &copy; VoiceCRM Security
            </p>
        </div>
    );
}
