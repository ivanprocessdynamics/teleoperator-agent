"use client";

import { useState, useEffect } from "react";
import { Campaign, CampaignColumn, CampaignRow } from "@/types/campaign";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, MoreHorizontal, Save, X } from "lucide-react";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, updateDoc, writeBatch, deleteDoc, addDoc } from "firebase/firestore";

interface CampaignTableProps {
    campaign: Campaign;
    onColumnsChange: (cols: CampaignColumn[]) => void;
}

export function CampaignTable({ campaign, onColumnsChange }: CampaignTableProps) {
    const [rows, setRows] = useState<CampaignRow[]>([]);
    const [loading, setLoading] = useState(true);

    // Fetch Rows
    useEffect(() => {
        if (!campaign.id) return;
        const q = query(collection(db, "campaign_rows"), where("campaign_id", "==", campaign.id));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetched: CampaignRow[] = [];
            snapshot.forEach((doc) => {
                fetched.push({ id: doc.id, ...doc.data() } as CampaignRow);
            });
            setRows(fetched);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [campaign.id]);

    // --- Column Management ---
    const addColumn = () => {
        const newColId = `col_${Date.now()}`;
        const newCols = [...campaign.columns, { id: newColId, key: newColId, label: "Nueva Variable" }];
        onColumnsChange(newCols);
    };

    const updateColumnLabel = (colId: string, newLabel: string) => {
        const newCols = campaign.columns.map(c => {
            if (c.id === colId) {
                // Sanitize key for prompt usage (simple regex)
                const safeKey = newLabel.toLowerCase().replace(/[^a-z0-9]/g, '_');
                return { ...c, label: newLabel, key: safeKey };
            }
            return c;
        });
        onColumnsChange(newCols);
    };

    const removeColumn = (colId: string) => {
        if (confirm("¿Estás seguro? Se borrarán los datos de esta columna.")) {
            const newCols = campaign.columns.filter(c => c.id !== colId);
            onColumnsChange(newCols);
        }
    };

    // --- Row Management ---
    const addRow = async () => {
        await addDoc(collection(db, "campaign_rows"), {
            campaign_id: campaign.id,
            data: {},
            status: 'pending'
        });
    };

    const updateCell = async (rowId: string, colId: string, value: string) => {
        // Optimistic update could go here, but for now direct firestore
        const rowRef = doc(db, "campaign_rows", rowId);
        // We need to merge the data field
        // Firestore weirdness with nested maps, easiest is to read current row or use dot notation update
        // Using "data.col_id" notation
        await updateDoc(rowRef, {
            [`data.${colId}`]: value
        });
    };

    const deleteRow = async (rowId: string) => {
        await deleteDoc(doc(db, "campaign_rows", rowId));
    };

    return (
        <div className="flex flex-col h-full border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                <h3 className="text-sm font-semibold text-gray-900">Datos de la Campaña</h3>
                <Button size="sm" variant="outline" onClick={addColumn} className="bg-white text-xs h-8">
                    <Plus className="mr-2 h-3.5 w-3.5" /> Columna
                </Button>
            </div>

            <div className="flex-1 overflow-auto">
                <table className="w-full text-sm border-collapse">
                    <thead className="bg-gray-50 z-10 sticky top-0">
                        <tr>
                            {campaign.columns.map((col) => (
                                <th key={col.id} className="min-w-[150px] border-b border-r border-gray-200 px-2 py-2 text-left">
                                    <div className="flex items-center justify-between group">
                                        <input
                                            className="bg-transparent border-none focus:ring-0 text-xs font-bold text-gray-700 uppercase tracking-wider w-full cursor-pointer hover:bg-gray-100 rounded px-1 py-0.5 transition-colors"
                                            value={col.label}
                                            onChange={(e) => updateColumnLabel(col.id, e.target.value)}
                                        />
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <MoreHorizontal className="h-3 w-3" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent>
                                                <DropdownMenuItem onClick={() => removeColumn(col.id)} className="text-red-600">
                                                    <Trash2 className="mr-2 h-4 w-4" /> Eliminar Columna
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                    <div className="text-[10px] text-gray-400 font-mono px-1">
                                        {'{{' + col.key + '}}'}
                                    </div>
                                </th>
                            ))}
                            <th className="w-[50px] border-b border-gray-200 px-2 py-2"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                        {rows.map((row) => (
                            <tr key={row.id} className="group hover:bg-gray-50">
                                {campaign.columns.map((col) => (
                                    <td key={`${row.id}-${col.id}`} className="border-r border-gray-100 p-0 relative">
                                        <input
                                            className="w-full h-full px-3 py-2.5 border-none focus:ring-2 focus:ring-inset focus:ring-blue-500 outline-none bg-transparent text-gray-900 text-sm"
                                            value={row.data[col.id] || ""}
                                            onChange={(e) => updateCell(row.id, col.id, e.target.value)}
                                            placeholder="..."
                                        />
                                    </td>
                                ))}
                                <td className="px-2 py-1 text-center">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => deleteRow(row.id)}
                                        className="h-7 w-7 text-gray-300 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </Button>
                                </td>
                            </tr>
                        ))}
                        {/* Empty State / Add Row */}
                        <tr>
                            <td colSpan={campaign.columns.length + 1} className="p-2">
                                <Button variant="ghost" size="sm" onClick={addRow} className="w-full justify-start text-gray-400 hover:text-gray-900 h-8">
                                    <Plus className="mr-2 h-3.5 w-3.5" /> Añadir Fila
                                </Button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}
