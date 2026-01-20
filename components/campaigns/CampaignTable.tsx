"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Campaign, CampaignColumn, CampaignRow } from "@/types/campaign";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, MoreHorizontal, X, ArrowDown } from "lucide-react";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, updateDoc, writeBatch, deleteDoc } from "firebase/firestore";
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

    // Use refs for value tracking to avoid stale closures in event listeners
    const rowsRef = useRef<CampaignRow[]>([]);
    const colsRef = useRef<CampaignColumn[]>([]);
    const selectionRef = useRef<SelectionRange | null>(null);

    // Debounce Timer Ref
    const saveTimeoutsRef = useRef<{ [key: string]: NodeJS.Timeout }>({});

    useEffect(() => {
        rowsRef.current = rows;
    }, [rows]);

    useEffect(() => {
        colsRef.current = campaign.columns;
    }, [campaign.columns]);

    useEffect(() => {
        selectionRef.current = selection;
    }, [selection]);


    // Fetch Rows
    useEffect(() => {
        if (!campaign.id) return;
        const q = query(collection(db, "campaign_rows"), where("campaign_id", "==", campaign.id));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetched: CampaignRow[] = [];
            let hasChanges = false;

            snapshot.docChanges().forEach((change) => {
                if (change.type !== 'removed') hasChanges = true;
            });

            // If we are actively editing, we might want to be careful about overwriting?
            // "Real-time" collaboration can be tricky with simple text inputs.
            // For now, we accept updates. If we notice typing lag, we might need to ignore remote updates to focused cell.

            snapshot.forEach((doc) => {
                fetched.push({ id: doc.id, ...doc.data() } as CampaignRow);
            });
            // Stable sort by ID for now to prevent jumping
            fetched.sort((a, b) => a.id.localeCompare(b.id));
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

    // Auto-generate rows on first load if empty
    useEffect(() => {
        if (!loading && rows.length === 0) {
            handleBatchAddRows(100);
        }
    }, [loading]);

    // --- OPTIMIZED UPDATE LOGIC ---
    const handleCellChange = (rowId: string, colId: string, newValue: string) => {
        // 1. Update Local State Immediately
        setRows(prev => prev.map(r => {
            if (r.id === rowId) {
                return { ...r, data: { ...r.data, [colId]: newValue } };
            }
            return r;
        }));

        // 2. Clear existing timeout for this cell
        const timeoutKey = `${rowId}-${colId}`;
        if (saveTimeoutsRef.current[timeoutKey]) {
            clearTimeout(saveTimeoutsRef.current[timeoutKey]);
        }

        // 3. Set new timeout (debounce 1000ms)
        saveTimeoutsRef.current[timeoutKey] = setTimeout(async () => {
            const rowRef = doc(db, "campaign_rows", rowId);
            await updateDoc(rowRef, {
                [`data.${colId}`]: newValue
            });
            delete saveTimeoutsRef.current[timeoutKey];
        }, 1000);
    };

    const deleteRow = async (rowId: string) => {
        await deleteDoc(doc(db, "campaign_rows", rowId));
    };

    // --- Selection and Copy/Paste ---

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

    // Clipboard Logic
    useEffect(() => {
        const handleKeyDown = async (e: KeyboardEvent) => {
            const sel = selectionRef.current;
            if (!sel) return;

            // CTRL+A: Select All
            if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
                e.preventDefault();
                const currentRows = rowsRef.current;
                const currentCols = colsRef.current;
                if (currentRows.length > 0 && currentCols.length > 0) {
                    setSelection({
                        startRowId: currentRows[0].id,
                        startColId: currentCols[0].id,
                        endRowId: currentRows[currentRows.length - 1].id,
                        endColId: currentCols[currentCols.length - 1].id
                    });
                }
                return;
            }

            // CTRL+C: Copy
            if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                // If focus is not on input, prevent default to avoid copying nothing?
                // Actually browsers handle copy from selected input naturally.
                // But we have a VIRTUAL selection across multiple inputs.
                e.preventDefault();
                const start = getCoordinates(sel.startRowId, sel.startColId);
                const end = getCoordinates(sel.endRowId, sel.endColId);

                const minRow = Math.min(start.rowIndex, end.rowIndex);
                const maxRow = Math.max(start.rowIndex, end.rowIndex);
                const minCol = Math.min(start.colIndex, end.colIndex);
                const maxCol = Math.max(start.colIndex, end.colIndex);

                let clipboardText = "";

                for (let i = minRow; i <= maxRow; i++) {
                    const rowData = [];
                    for (let j = minCol; j <= maxCol; j++) {
                        const colId = colsRef.current[j].id;
                        const cellValue = rowsRef.current[i].data[colId] || "";
                        rowData.push(cellValue);
                    }
                    clipboardText += rowData.join("\t") + (i < maxRow ? "\n" : "");
                }

                await navigator.clipboard.writeText(clipboardText);
                return;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);


    const onPasteHandler = async (e: React.ClipboardEvent) => {
        if (!selection) return;

        e.preventDefault();
        const text = e.clipboardData.getData('text');
        const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== "");
        if (lines.length === 0) return;

        const start = getCoordinates(selection.startRowId, selection.startColId);
        const end = getCoordinates(selection.endRowId, selection.endColId);
        const minRow = Math.min(start.rowIndex, end.rowIndex);
        const minCol = Math.min(start.colIndex, end.colIndex);

        const batch = writeBatch(db);
        let batchCount = 0;

        // Optimistically update local state immediately
        const newRows = [...rows];

        lines.forEach((line, i) => {
            const values = line.split('\t');
            const targetRowIndex = minRow + i;

            if (targetRowIndex < rows.length) {
                const targetRow = rows[targetRowIndex];
                const updates: any = {};

                // Update local model clone
                const newRowData = { ...newRows[targetRowIndex].data };

                values.forEach((val, j) => {
                    const targetColIndex = minCol + j;
                    if (targetColIndex < campaign.columns.length) {
                        const colId = campaign.columns[targetColIndex].id;
                        updates[`data.${colId}`] = val.trim();
                        newRowData[colId] = val.trim();
                    }
                });

                newRows[targetRowIndex] = { ...newRows[targetRowIndex], data: newRowData };

                if (Object.keys(updates).length > 0) {
                    const rowRef = doc(db, "campaign_rows", targetRow.id);
                    batch.update(rowRef, updates);
                    batchCount++;
                }
            }
        });

        setRows(newRows); // Flush optimistic updates

        if (batchCount > 0) {
            await batch.commit();
        }
    };

    return (
        <div
            className="flex flex-col h-full border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden select-none outline-none"
            onMouseUp={handleMouseUp}
            tabIndex={0}
            onPaste={onPasteHandler}
        >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                <h3 className="text-sm font-semibold text-gray-900">Datos de la Campaña</h3>
                <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={addColumn} className="bg-white text-xs h-8">
                        <Plus className="mr-2 h-3.5 w-3.5" /> Columna
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleBatchAddRows(100)} className="text-xs h-8 text-gray-500 hover:text-gray-900">
                        <ArrowDown className="mr-2 h-3.5 w-3.5" /> Añadir más filas
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-auto relative">
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
                                                    selected && "bg-transparent text-blue-900 font-medium placeholder:text-blue-300"
                                                )}
                                                value={row.data[col.id] || ""}
                                                onChange={(e) => handleCellChange(row.id, col.id, e.target.value)}
                                            />
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>

                {rows.length === 0 && !loading && (
                    <div className="flex flex-col items-center justify-center p-10 text-gray-400 space-y-4">
                        <p>Generando filas...</p>
                    </div>
                )}
            </div>
        </div>
    );
}
