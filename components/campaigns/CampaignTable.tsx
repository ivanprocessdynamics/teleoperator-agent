"use client";

import { useState, useEffect, useRef, memo, useCallback } from "react";
import { Campaign, CampaignColumn, CampaignRow } from "@/types/campaign";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, MoreHorizontal, ArrowDown } from "lucide-react";
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

// --- OPTIMIZED CELL COMPONENT ---
interface CellProps {
    rowId: string;
    colId: string;
    initialValue: string;
    isSelected: boolean;
    isDragging: boolean;
    onMouseDown: (rowId: string, colId: string) => void;
    onMouseEnter: (rowId: string, colId: string) => void;
    onChange: (rowId: string, colId: string, val: string) => void;
    onPaste: (e: React.ClipboardEvent, rowId: string, colId: string) => void;
}

const CampaignCell = memo(({
    rowId, colId, initialValue, isSelected, isDragging, onMouseDown, onMouseEnter, onChange, onPaste
}: CellProps) => {
    const [value, setValue] = useState(initialValue);

    // Sync with external changes (e.g. from Batch Paste or Firestore fetch)
    // We strictly sync if initialValue changes. 
    useEffect(() => {
        setValue(initialValue);
    }, [initialValue]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVal = e.target.value;
        setValue(newVal);
        onChange(rowId, colId, newVal);
    };

    return (
        <td
            className={cn(
                "border-r border-gray-100 p-0 relative cursor-cell",
                isSelected && "bg-blue-50 ring-1 ring-inset ring-blue-500 z-10"
            )}
            onMouseDown={() => onMouseDown(rowId, colId)}
            onMouseEnter={() => onMouseEnter(rowId, colId)}
        >
            <input
                className={cn(
                    "w-full h-full px-3 py-2.5 border-none outline-none bg-transparent text-gray-900 text-sm",
                    isSelected && "bg-transparent text-blue-900 font-medium placeholder:text-blue-300"
                )}
                value={value}
                onChange={handleChange}
                onPaste={(e) => onPaste(e, rowId, colId)}
                style={{ pointerEvents: isDragging ? 'none' : 'auto' }}
            />
        </td>
    );
}, (prev, next) => {
    return (
        prev.initialValue === next.initialValue &&
        prev.isSelected === next.isSelected &&
        prev.isDragging === next.isDragging &&
        // Important: check function and string identity. 
        // With useCallback in parent, these functions will be stable.
        prev.rowId === next.rowId &&
        prev.colId === next.colId
    );
});
CampaignCell.displayName = "CampaignCell";


export function CampaignTable({ campaign, onColumnsChange }: CampaignTableProps) {
    const [rows, setRows] = useState<CampaignRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [selection, setSelection] = useState<SelectionRange | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    // Refs
    const rowsRef = useRef<CampaignRow[]>([]);
    const colsRef = useRef<CampaignColumn[]>([]);
    const selectionRef = useRef<SelectionRange | null>(null);
    const saveTimeoutsRef = useRef<{ [key: string]: NodeJS.Timeout }>({});

    // Sync Refs
    useEffect(() => { rowsRef.current = rows; }, [rows]);
    useEffect(() => { colsRef.current = campaign.columns; }, [campaign.columns]);
    useEffect(() => { selectionRef.current = selection; }, [selection]);

    // Fetch Rows
    useEffect(() => {
        if (!campaign.id) return;
        const q = query(collection(db, "campaign_rows"), where("campaign_id", "==", campaign.id));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetched: CampaignRow[] = [];
            snapshot.forEach((doc) => {
                fetched.push({ id: doc.id, ...doc.data() } as CampaignRow);
            });
            fetched.sort((a, b) => a.id.localeCompare(b.id));
            setRows(fetched);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [campaign.id]);

    // Init rows
    useEffect(() => {
        if (!loading && rows.length === 0) {
            handleBatchAddRows(100);
        }
    }, [loading]);

    // Helpers
    const getCoordinates = useCallback((rowId: string, colId: string) => {
        // Accessing ref instead of state to avoid dependency on 'rows' in callbacks
        const rowIndex = rowsRef.current.findIndex(r => r.id === rowId);
        const colIndex = colsRef.current.findIndex(c => c.id === colId);
        return { rowIndex, colIndex };
    }, []);

    const getRange = useCallback(() => {
        const sel = selectionRef.current;
        if (!sel) return null;
        const start = getCoordinates(sel.startRowId, sel.startColId);
        const end = getCoordinates(sel.endRowId, sel.endColId);
        // Check if IDs are valid
        if (start.rowIndex === -1 || end.rowIndex === -1) return null;

        return {
            minRow: Math.min(start.rowIndex, end.rowIndex),
            maxRow: Math.max(start.rowIndex, end.rowIndex),
            minCol: Math.min(start.colIndex, end.colIndex),
            maxCol: Math.max(start.colIndex, end.colIndex),
        };
    }, [getCoordinates]);

    // --- Actions ---
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

    const addColumn = () => {
        const newColId = `col_${Date.now()}`;
        const newCols = [...campaign.columns, { id: newColId, key: newColId, label: "Nueva Variable" }];
        onColumnsChange(newCols);
    };

    const removeColumn = (colId: string) => {
        if (confirm("Se borrarán los datos de esta columna.")) {
            const newCols = campaign.columns.filter(c => c.id !== colId);
            onColumnsChange(newCols);
        }
    };

    const handleBatchAddRows = async (count: number = 100) => {
        const batch = writeBatch(db);
        const rowsCollection = collection(db, "campaign_rows");
        for (let i = 0; i < count; i++) {
            const newDocRef = doc(rowsCollection);
            batch.set(newDocRef, { campaign_id: campaign.id, data: {}, status: 'pending' });
        }
        await batch.commit();
    };

    // --- Optimization Fix: useCallback handlers ---

    const handleCellChange = useCallback((rowId: string, colId: string, newValue: string) => {
        // Debounced Save
        const timeoutKey = `${rowId}-${colId}`;
        if (saveTimeoutsRef.current[timeoutKey]) clearTimeout(saveTimeoutsRef.current[timeoutKey]);

        saveTimeoutsRef.current[timeoutKey] = setTimeout(async () => {
            const rowRef = doc(db, "campaign_rows", rowId);
            await updateDoc(rowRef, { [`data.${colId}`]: newValue });
            delete saveTimeoutsRef.current[timeoutKey];
        }, 1000);

        // Silent Ref Update for Copy/Paste validity
        const rowIndex = rowsRef.current.findIndex(r => r.id === rowId);
        if (rowIndex !== -1) {
            if (!rowsRef.current[rowIndex].data) rowsRef.current[rowIndex].data = {};
            rowsRef.current[rowIndex].data[colId] = newValue;
        }
    }, []);

    const handleMouseDown = useCallback((rowId: string, colId: string) => {
        setIsDragging(true);
        setSelection({ startRowId: rowId, startColId: colId, endRowId: rowId, endColId: colId });
    }, []);

    const handleMouseEnter = useCallback((rowId: string, colId: string) => {
        // Helper to check drag state without triggering re-renders from the state itself?
        // We need 'isDragging' state. But 'setIsDragging' is safe.
        // We use setSelection updater form to access current selection
        setSelection((prev) => {
            // We can't access isDragging here easily without prop dependency or Ref
            // But we know this function is called only on MouseEnter
            // To be safe and avoid stale closures, we can assume if mouse is down (tracked globally?)
            // Actually, we are using the `isDragging` state in parent. 
            // If we depend on `isDragging`, this function changes when `isDragging` changes.
            // But `isDragging` changes only on Down/Up (once per drag). So it's fine.
            if (!prev) return prev;
            return {
                ...prev,
                endRowId: rowId,
                endColId: colId
            };
        });
    }, []);
    // ^ This `handleMouseEnter` is actually tricky. If we rely on `isDragging` in the closure, 
    // it won't work if we don't include it in deps. If we include it, it's fine.
    // However, `isDragging` is initially false. When it becomes true, this handler updates.
    // That's acceptable.

    // Better: Check isDragging in the component `onMouseEnter` logic? 
    // In `CampaignCell`, we call `onMouseEnter`. 
    // Let's modify `CampaignCell` to only call `onMouseEnter` if we (the cell) think we should?
    // No, logic belongs in parent.
    // Let's just create a `isDraggingRef`?
    const isDraggingRef = useRef(false);
    useEffect(() => { isDraggingRef.current = isDragging; }, [isDragging]);

    const handleMouseEnterOptimized = useCallback((rowId: string, colId: string) => {
        if (!isDraggingRef.current) return;
        setSelection((prev) => prev ? ({ ...prev, endRowId: rowId, endColId: colId }) : null);
    }, []);


    // --- Paste Logic ---
    const handlePaste = useCallback(async (e: React.ClipboardEvent, rowId: string, colId: string) => {
        const clipboardData = e.clipboardData.getData('text');
        if (clipboardData.includes('\n') || clipboardData.includes('\t')) {
            e.preventDefault();

            const lines = clipboardData.split(/\r\n|\n/).filter(line => line.trim() !== "");
            if (lines.length === 0) return;

            const startCoords = getCoordinates(rowId, colId);
            const batch = writeBatch(db);
            let batchCount = 0;

            const newRows = [...rowsRef.current]; // Use ref for current state

            lines.forEach((line, i) => {
                const values = line.split('\t');
                const targetRowIndex = startCoords.rowIndex + i;

                if (targetRowIndex < newRows.length) {
                    const targetRow = newRows[targetRowIndex];
                    const updates: any = {};
                    const newDataMap = { ...targetRow.data };

                    values.forEach((val, j) => {
                        const targetColIndex = startCoords.colIndex + j;
                        const targetCol = colsRef.current[targetColIndex]; // Use ref
                        if (targetCol) {
                            updates[`data.${targetCol.id}`] = val.trim();
                            newDataMap[targetCol.id] = val.trim();
                        }
                    });

                    if (Object.keys(updates).length > 0) {
                        newRows[targetRowIndex] = { ...targetRow, data: newDataMap };
                        const rowRef = doc(db, "campaign_rows", targetRow.id);
                        batch.update(rowRef, updates);
                        batchCount++;
                    }
                }
            });

            if (batchCount > 0) {
                setRows(newRows);
                await batch.commit();
            }
        }
    }, [getCoordinates]);

    // --- Global Keyboard Actions (Ctrl+A, Backspace) ---
    useEffect(() => {
        const handleKeyDown = async (e: KeyboardEvent) => {
            const sel = selectionRef.current;

            // CTRL+A: Select All
            if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
                e.preventDefault();
                const r = rowsRef.current;
                const c = colsRef.current;
                if (r.length > 0 && c.length > 0) {
                    setSelection({
                        startRowId: r[0].id,
                        startColId: c[0].id,
                        endRowId: r[r.length - 1].id,
                        endColId: c[c.length - 1].id
                    });
                }
                return;
            }

            // Backspace / Delete: Clear Content
            if (sel && (e.key === 'Backspace' || e.key === 'Delete')) {
                // Heuristic: If multi-selection, CLEAR.
                // If single selection:
                // - If active element is INPUT, allow default (delete text).
                // - If active element is NOT input (rare here), clear cell.
                const isMulti = sel.startRowId !== sel.endRowId || sel.startColId !== sel.endColId;

                // If multi-select, we prevent default (nav back) and clear cells.
                if (isMulti) {
                    e.preventDefault();

                    const range = getRange(); // This uses selectionRef and refs
                    if (!range) return;

                    const batch = writeBatch(db);
                    const newRows = [...rowsRef.current];
                    let batchCount = 0;

                    for (let i = range.minRow; i <= range.maxRow; i++) {
                        const updates: any = {};
                        const targetRow = newRows[i];
                        const newDataMap = { ...targetRow.data };

                        for (let j = range.minCol; j <= range.maxCol; j++) {
                            const colId = colsRef.current[j].id;
                            updates[`data.${colId}`] = "";
                            newDataMap[colId] = "";
                        }

                        newRows[i] = { ...targetRow, data: newDataMap };
                        batch.update(doc(db, "campaign_rows", targetRow.id), updates);
                        batchCount++;
                    }

                    setRows(newRows); // Optimistic UI update
                    if (batchCount > 0) await batch.commit();
                }
            }

            // Copy (Ctrl+C) logic acts on Ref, already correct in previous thought/code
            if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                if (!sel) return;
                const isMulti = sel.startRowId !== sel.endRowId || sel.startColId !== sel.endColId;
                // If single cell and editing, let native copy work
                if (!isMulti && document.activeElement?.tagName === 'INPUT') return;

                e.preventDefault();
                const range = getRange();
                if (!range) return;

                let clipboardText = "";
                for (let i = range.minRow; i <= range.maxRow; i++) {
                    const rowData = [];
                    for (let j = range.minCol; j <= range.maxCol; j++) {
                        const colId = colsRef.current[j].id;
                        rowData.push(rowsRef.current[i].data[colId] || "");
                    }
                    clipboardText += rowData.join("\t") + (i < range.maxRow ? "\n" : "");
                }
                await navigator.clipboard.writeText(clipboardText);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [getCoordinates, getRange]); // getRange depends on getCoordinates which is useCallback


    // --- Selection Helper ---
    const isSelected = (rowId: string, colId: string) => {
        if (!selection) return false;
        // Optimization: check if we are outside the bounding box first?
        // Actually, let's just do the range check, it's fast enough math.
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

    return (
        <div
            className="flex flex-col h-full border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden select-none outline-none"
            onMouseUp={() => setIsDragging(false)}
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
                                {campaign.columns.map((col) => (
                                    <CampaignCell
                                        key={col.id}
                                        rowId={row.id}
                                        colId={col.id}
                                        initialValue={row.data[col.id] || ""}
                                        isSelected={isSelected(row.id, col.id)}
                                        isDragging={isDragging}
                                        // Pass optimized handlers
                                        onMouseDown={handleMouseDown}
                                        onMouseEnter={handleMouseEnterOptimized} // Using the localized logic
                                        onChange={handleCellChange}
                                        onPaste={handlePaste}
                                    />
                                ))}
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
