"use client";

import { useState, useEffect, useRef } from "react";
import { Campaign, CampaignColumn, CampaignRow } from "@/types/campaign";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, MoreHorizontal, X, Copy, Check } from "lucide-react";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, updateDoc, writeBatch, deleteDoc, addDoc } from "firebase/firestore";
import { cn } from "@/lib/utils";

interface CampaignTableProps {
    campaign: Campaign;
    onColumnsChange: (cols: CampaignColumn[]) => void;
}

interface SelectionRange {
    startRowId: string;
    startColId: string;
    endRowId: string;
    endColId: string;
}

export function CampaignTable({ campaign, onColumnsChange }: CampaignTableProps) {
    const [rows, setRows] = useState<CampaignRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [selection, setSelection] = useState<SelectionRange | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    // Sort rows by creation time usually, but for now just array order
    // We need stable row order for selection to work intuitively
    // Ideally rows should have an 'index' field. For now relying on fetch order.

    // Fetch Rows
    useEffect(() => {
        if (!campaign.id) return;
        const q = query(collection(db, "campaign_rows"), where("campaign_id", "==", campaign.id));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetched: CampaignRow[] = [];
            snapshot.forEach((doc) => {
                fetched.push({ id: doc.id, ...doc.data() } as CampaignRow);
            });
            // Auto-sort by ID or creation time if available to keep stable order
            // fetched.sort((a, b) => a.created_at - b.created_at); 
            setRows(fetched);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [campaign.id]);

    // Initialize 100 rows if empty on load (Optional, or user triggers it)
    useEffect(() => {
        if (!loading && rows.length === 0) {
            // handleBatchAddRows(100); // Decided NOT to auto-create 100 on load to save writes, user can click button
        }
    }, [loading, rows.length]);

    // --- Column Management ---
    const addColumn = () => {
        const newColId = `col_${Date.now()}`;
        const newCols = [...campaign.columns, { id: newColId, key: newColId, label: "Nueva Variable" }];
        onColumnsChange(newCols);
    };

    const updateColumnLabel = (colId: string, newLabel: string) => {
        const newCols = campaign.columns.map(c => {
            if (c.id === colId) {
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
    const handleBatchAddRows = async (count: number = 100) => {
        // Firestore batch limit is 500
        const batch = writeBatch(db);
        const rowsCollection = collection(db, "campaign_rows");

        for (let i = 0; i < count; i++) {
            const newDocRef = doc(rowsCollection);
            batch.set(newDocRef, {
                campaign_id: campaign.id,
                data: {},
                status: 'pending'
            });
        }

        await batch.commit();
    };

    const updateCell = async (rowId: string, colId: string, value: string) => {
        const rowRef = doc(db, "campaign_rows", rowId);
        await updateDoc(rowRef, {
            [`data.${colId}`]: value
        });
    };

    const deleteRow = async (rowId: string) => {
        await deleteDoc(doc(db, "campaign_rows", rowId));
    };

    // --- Selection and Copy/Paste ---

    // Helper to find indices
    const getCoordinates = (rowId: string, colId: string) => {
        const rowIndex = rows.findIndex(r => r.id === rowId);
        const colIndex = campaign.columns.findIndex(c => c.id === colId);
        return { rowIndex, colIndex };
    };

    const handleMouseDown = (rowId: string, colId: string) => {
        setIsDragging(true);
        setSelection({
            startRowId: rowId,
            startColId: colId,
            endRowId: rowId,
            endColId: colId
        });
    };

    const handleMouseEnter = (rowId: string, colId: string) => {
        if (isDragging && selection) {
            setSelection({
                ...selection,
                endRowId: rowId,
                endColId: colId
            });
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    // Check if cell is selected
    const isSelected = (rowId: string, colId: string) => {
        if (!selection) return false;
        const start = getCoordinates(selection.startRowId, selection.startColId);
        const end = getCoordinates(selection.endRowId, selection.endColId);
        const current = getCoordinates(rowId, colId);

        const minRow = Math.min(start.rowIndex, end.rowIndex);
        const maxRow = Math.max(start.rowIndex, end.rowIndex);
        const minCol = Math.min(start.colIndex, end.colIndex);
        const maxCol = Math.max(start.colIndex, end.colIndex);

        return current.rowIndex >= minRow && current.rowIndex <= maxRow &&
            current.colIndex >= minCol && current.colIndex <= maxCol;
    };

    const handlePaste = async (e: React.ClipboardEvent) => {
        // Prevent default only if we are in the table context (crudely detected)
        // Actually, let's just use the selected cell as anchor
        if (!selection) return;

        e.preventDefault();
        const text = e.clipboardData.getData('text');
        const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== "");
        if (lines.length === 0) return;

        const start = getCoordinates(selection.startRowId, selection.startColId);
        const minRow = Math.min(start.rowIndex, getCoordinates(selection.endRowId, selection.endColId).rowIndex);
        const minCol = Math.min(start.colIndex, getCoordinates(selection.endRowId, selection.endColId).colIndex);

        const batch = writeBatch(db);
        let batchCount = 0;

        lines.forEach((line, i) => {
            const values = line.split('\t'); // TSV is standard for Excel copy
            const targetRowIndex = minRow + i;

            if (targetRowIndex < rows.length) {
                const targetRow = rows[targetRowIndex];
                const updates: any = {};

                values.forEach((val, j) => {
                    const targetColIndex = minCol + j;
                    if (targetColIndex < campaign.columns.length) {
                        const colId = campaign.columns[targetColIndex].id;
                        updates[`data.${colId}`] = val.trim();
                    }
                });

                if (Object.keys(updates).length > 0) {
                    const rowRef = doc(db, "campaign_rows", targetRow.id);
                    batch.update(rowRef, updates);
                    batchCount++;
                }
            }
        });

        if (batchCount > 0) {
            await batch.commit();
        }
    };

    return (
        <div
            className="flex flex-col h-full border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden select-none"
            onMouseUp={handleMouseUp}
        >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                <h3 className="text-sm font-semibold text-gray-900">Datos de la Campaña</h3>
                <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={addColumn} className="bg-white text-xs h-8">
                        <Plus className="mr-2 h-3.5 w-3.5" /> Columna
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleBatchAddRows(100)} className="bg-white text-xs h-8">
                        <Plus className="mr-2 h-3.5 w-3.5" /> 100 Filas
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-auto relative" onPaste={handlePaste}>
                <table className="w-full text-sm border-collapse table-fixed">
                    <thead className="bg-gray-50 z-10 sticky top-0">
                        <tr>
                            <th className="w-[40px] border-b border-r border-gray-200 bg-gray-50"></th>
                            {campaign.columns.map((col) => (
                                <th key={col.id} className="w-[150px] border-b border-r border-gray-200 px-2 py-2 text-left bg-gray-50">
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
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                        {rows.map((row, rowIndex) => (
                            <tr key={row.id}>
                                <td className="text-center text-xs text-gray-400 bg-gray-50 border-r border-b border-gray-200">{rowIndex + 1}</td>
                                {campaign.columns.map((col) => {
                                    const selected = isSelected(row.id, col.id);
                                    return (
                                        <td
                                            key={`${row.id}-${col.id}`}
                                            className={cn(
                                                "border-r border-gray-100 p-0 relative cursor-cell",
                                                selected && "bg-blue-50 ring-1 ring-inset ring-blue-500"
                                            )}
                                            onMouseDown={() => handleMouseDown(row.id, col.id)}
                                            onMouseEnter={() => handleMouseEnter(row.id, col.id)}
                                        >
                                            <input
                                                className={cn(
                                                    "w-full h-full px-3 py-2.5 border-none outline-none bg-transparent text-gray-900 text-sm",
                                                    selected && "bg-transparent text-blue-900 font-medium"
                                                )}
                                                value={row.data[col.id] || ""}
                                                onChange={(e) => updateCell(row.id, col.id, e.target.value)}
                                                // Prevent input focus from stealing copy event if selecting multiple
                                                readOnly={isDragging || (selection && (selection.startRowId !== selection.endRowId || selection.startColId !== selection.endColId)) ? true : false}
                                            // Re-enable editing on double click or specific click logic could be added
                                            />
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Visual overlay for bottom actions or empty state */}
                {rows.length === 0 && !loading && (
                    <div className="flex flex-col items-center justify-center p-10 text-gray-400">
                        <p>La tabla está vacía.</p>
                        <Button variant="outline" onClick={() => handleBatchAddRows(100)} className="mt-4">
                            Generar 100 Filas
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
