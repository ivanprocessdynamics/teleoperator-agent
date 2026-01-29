"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Loader2, Database, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
    const { userData, user } = useAuth();
    const [migrating, setMigrating] = useState(false);
    const [migrationResult, setMigrationResult] = useState<string | null>(null);

    const handleMigrateWorkspaces = async () => {
        if (!user?.uid) return;

        setMigrating(true);
        setMigrationResult(null);

        try {
            const response = await fetch(
                `/api/admin/migrate-workspace-members?superadminUid=${user.uid}&addSuperadmin=true`
            );
            const data = await response.json();

            if (data.success) {
                setMigrationResult(`✅ ${data.message}`);
                toast.success("Migración completada");
            } else {
                setMigrationResult(`❌ Error: ${data.error}`);
                toast.error("Error en la migración");
            }
        } catch (error) {
            console.error("Migration error:", error);
            setMigrationResult("❌ Error de conexión");
            toast.error("Error de conexión");
        } finally {
            setMigrating(false);
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Configuración</h1>

            {/* User Info */}
            <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Tu Cuenta</h2>
                <div className="space-y-2 text-sm">
                    <p><span className="text-gray-500">Email:</span> <span className="font-medium">{userData?.email}</span></p>
                    <p><span className="text-gray-500">UID:</span> <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-xs">{userData?.uid}</code></p>
                    <p><span className="text-gray-500">Rol:</span> <span className="font-medium capitalize">{userData?.role}</span></p>
                </div>
            </div>

            {/* Admin Tools - Only for superadmin */}
            {userData?.role === 'superadmin' && (
                <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Herramientas de Administrador</h2>

                    <div className="space-y-4">
                        <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/50">
                            <h3 className="font-medium text-amber-800 dark:text-amber-200 mb-2">
                                Migrar Miembros de Workspaces
                            </h3>
                            <p className="text-sm text-amber-700 dark:text-amber-300 mb-4">
                                Añade a los propietarios de workspaces existentes como miembros en la subcolección.
                                Esto es necesario para que aparezcan en el listado de equipos.
                            </p>
                            <Button
                                onClick={handleMigrateWorkspaces}
                                disabled={migrating}
                                className="bg-amber-600 hover:bg-amber-700 text-white"
                            >
                                {migrating ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Migrando...
                                    </>
                                ) : (
                                    <>
                                        <Database className="mr-2 h-4 w-4" />
                                        Ejecutar Migración
                                    </>
                                )}
                            </Button>

                            {migrationResult && (
                                <div className="mt-4 p-3 rounded bg-white dark:bg-gray-900 text-sm">
                                    {migrationResult}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
