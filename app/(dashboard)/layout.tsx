import { Sidebar } from "@/components/Sidebar";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-screen w-full bg-white dark:bg-gray-950">
            <Sidebar />
            <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 p-4 md:p-6 lg:p-8">
                <div className="animate-fade-in">
                    {children}
                </div>
            </main>
        </div>
    );
}

