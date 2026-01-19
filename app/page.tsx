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
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-900 border-t-transparent"></div>
          <p className="text-sm font-medium text-gray-500">Loading VoiceCRM...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white p-4">
      <div className="flex w-full max-w-sm flex-col items-center space-y-6 text-center">
        <div className="flex flex-col items-center space-y-2">
          <div className="h-10 w-10 rounded-lg bg-gray-900 flex items-center justify-center">
            <LayoutDashboard className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">VoiceCRM</h1>
          <p className="text-sm text-gray-500">
            Manage your Retell AI voice campaigns with ease.
          </p>
        </div>

        <div className="w-full space-y-4">
          <Button
            onClick={() => signInWithGoogle()}
            className="w-full"
            size="lg"
          >
            Sign in with Google
          </Button>
        </div>
      </div>
    </div>
  );
}
