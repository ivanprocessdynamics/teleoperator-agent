"use client";

import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Users, Phone, BarChart3 } from "lucide-react";

export default function DashboardPage() {
    const { user } = useAuth();

    return (
        <div className="flex flex-col gap-6">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Dashboard</h1>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-700">Total Calls</CardTitle>
                        <Phone className="h-4 w-4 text-gray-900" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-gray-900">0</div>
                        <p className="text-xs text-gray-600 font-medium">+0% from last month</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-700">Active Agents</CardTitle>
                        <Users className="h-4 w-4 text-gray-900" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-gray-900">0</div>
                        <p className="text-xs text-gray-600 font-medium">+0 since last hour</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-700">Success Rate</CardTitle>
                        <Activity className="h-4 w-4 text-gray-900" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-gray-900">0%</div>
                        <p className="text-xs text-gray-600 font-medium">+0% from last week</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-700">Usage Cost</CardTitle>
                        <BarChart3 className="h-4 w-4 text-gray-900" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-gray-900">$0.00</div>
                        <p className="text-xs text-gray-600 font-medium">+0% from last month</p>
                    </CardContent>
                </Card>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
                <h2 className="text-lg font-semibold mb-4 text-gray-900">Activity Overview</h2>
                <div className="h-[200px] flex items-center justify-center text-gray-600 bg-gray-50 border border-dashed border-gray-300 rounded-lg">
                    Chart Placeholder
                </div>
            </div>
        </div>
    );
}
