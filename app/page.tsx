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
    <div className="flex min-h-screen items-center justify-center bg-white bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]">
      {/* Subtle white glow behind the card */}
      <div className="absolute inset-0 bg-white/40 bg-[radial-gradient(ellipse_at_center,transparent_0%,white_100%)] pointer-events-none" />

      <div className="relative w-full max-w-[420px] p-10 md:p-12 bg-white border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl">
        <div className="flex flex-col items-center text-center">
          {/* Logo / Icon */}
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gray-900 shadow-sm transition-transform hover:scale-105 duration-300 mb-8">
            <LayoutDashboard className="h-7 w-7 text-white" />
          </div>

          <div className="space-y-3 mb-10">
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Bienvenido a VoiceCRM</h1>
            <p className="text-sm text-gray-500 leading-relaxed max-w-[280px] mx-auto">
              La plataforma definitiva para gestionar tus agentes de voz con IA.
            </p>
          </div>

          <div className="w-full">
            <Button
              onClick={() => signInWithGoogle()}
              className="w-full h-11 bg-gray-900 text-white hover:bg-gray-800 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 flex items-center justify-center gap-3 text-sm font-medium rounded-lg"
              size="default"
            >
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
            <p className="mt-5 text-[10px] text-gray-400">
              Al continuar, aceptas nuestros términos y condiciones.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
