"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LayoutDashboard } from "lucide-react";

export default function Home() {

  const { user, signInWithGoogle, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-900 border-t-transparent"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white p-4">
      <div className="flex w-full max-w-sm flex-col items-center space-y-8 text-center">
        {/* Logo / Icon */}
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-900 shadow-xl transition-transform hover:scale-105 duration-300">
          <LayoutDashboard className="h-8 w-8 text-white" />
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Bienvenido a VoiceCRM</h1>
          <p className="text-gray-500 max-w-[280px] mx-auto leading-relaxed">
            La plataforma definitiva para gestionar tus agentes de voz con IA.
          </p>
        </div>

        <div className="w-full pt-4">
          <Button
            onClick={() => signInWithGoogle()}
            className="w-full h-12 bg-gray-900 text-white hover:bg-gray-800 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg flex items-center justify-center gap-3 text-base font-medium relative overflow-hidden group"
            size="lg"
          >
            {/* Colorful Google G Logo */}
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.26.81-.58z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continuar con Google
          </Button>
          <p className="mt-6 text-xs text-gray-400">
            Al continuar, aceptas nuestros términos y condiciones.
          </p>
        </div>
      </div>
    </div>
  );
}
