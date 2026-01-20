"use client";

import { useState, useEffect, useRef, memo } from "react";
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

// --- OPTIMIZED CELL COMPONENT ---
// Keeps its own state to prevent re-renders of the whole table from interrupting typing
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
}: CellProps) => { // Removed onKeyDown from props as it wasn't used in the component body
    const [value, setValue] = useState(initialValue);

    // Sync with external changes ONLY if not focused (to allow remote updates without overwriting typing)
    // Actually, simply syncing on prop change is usually fine if we debounce the up-propagation
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
                isSelected && "bg-blue-50 ring-1 ring-inset ring-blue-500 z-10" // z-10 to show ring above borders
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
                // We do NOT block focus. Excel allows focusing a selected cell to edit it.
                // But if IS DRAGGING, we disable pointer events on input to allow the TD to capture mouse
                style={{ pointerEvents: isDragging ? 'none' : 'auto' }}
            />
        </td>
    );
}, (prev, next) => {
    // Custom equality check for performance
    return (
        prev.initialValue === next.initialValue &&
        prev.isSelected === next.isSelected &&
        prev.isDragging === next.isDragging
    );
});
CampaignCell.displayName = "CampaignCell";


export function CampaignTable({ campaign, onColumnsChange }: CampaignTableProps) {
    const [rows, setRows] = useState<CampaignRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [selection, setSelection] = useState<SelectionRange | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    // Refs for heavy lifting without re-renders
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
            let hasPendingWrites = snapshot.metadata.hasPendingWrites;

            // If we have pending writes (local changes), we might want to skip full re-set? 
            // Better to just merge? For now, standard fetch.

            snapshot.forEach((doc) => {
                fetched.push({ id: doc.id, ...doc.data() } as CampaignRow);
            });
            // Sort by simple string ID for stability.
            // Ideally we'd use a numerical index or timestamp.
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

    // --- Actions ---
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

    const handleBatchAddRows = async (count: number = 100) => {
        const batch = writeBatch(db);
        const rowsCollection = collection(db, "campaign_rows");
        for (let i = 0; i < count; i++) {
            const newDocRef = doc(rowsCollection);
            batch.set(newDocRef, { campaign_id: campaign.id, data: {}, status: 'pending' });
        }
        await batch.commit();
    };


    // --- Optimized Update ---
    const handleCellChange = (rowId: string, colId: string, newValue: string) => {
        // Debounce Firestore Write
        const timeoutKey = `${rowId}-${colId}`;
        if (saveTimeoutsRef.current[timeoutKey]) clearTimeout(saveTimeoutsRef.current[timeoutKey]);

        saveTimeoutsRef.current[timeoutKey] = setTimeout(async () => {
            const rowRef = doc(db, "campaign_rows", rowId);
            await updateDoc(rowRef, { [`data.${colId}`]: newValue });
            delete saveTimeoutsRef.current[timeoutKey];
        }, 1000);

        // NOTE: We do NOT update 'rows' state here immediately if we trust the Child component 
        // to hold the visual state. However, to keep Copy/Paste working with latest data, 
        // we SHOULD update the Ref at least?
        // Or we update state but since Child is memoized on 'initialValue', it won't re-render 
        // unless we change the prop passed to it.
        // Let's update the state silent-ish? 
        // Actually, updating state triggers re-render. 
        // We will update state, but `CampaignCell` checks `prev.initialValue === next.initialValue`.
        // If we update state, the `initialValue` prop changes.
        // Wait, if we type 'a', state becomes 'a'. Prop becomes 'a'.
        // Child has local 'a'. `useEffect` in child sees prop 'a', calls `setValue('a')`. 
        // This is a loop but stable.
        // The LAG comes from the React Reconcliation of 100 rows.
        // We really should avoid `setRows` on every char.

        // BETTER APPROACH: Update `rowsRef.current` silently for logic, 
        // and ONLY update `rows` state (Firestore) when it comes back or very lazily.

        // We will NOT call setRows here. We rely on the Child to hold the UI state.
        // But we must update the ref so Copy works.
        const rowIndex = rowsRef.current.findIndex(r => r.id === rowId);
        if (rowIndex !== -1) {
            // Mutate ref deep clone-ish just for local logic?
            // Actually mutation is fine for Ref if we don't depend on immutability for re-renders elsewhere immediately
            if (!rowsRef.current[rowIndex].data) rowsRef.current[rowIndex].data = {};
            rowsRef.current[rowIndex].data[colId] = newValue;
        }
    };


    // --- Selection Logic ---
    const getCoordinates = (rowId: string, colId: string) => {
        const rowIndex = rows.findIndex(r => r.id === rowId);
        const colIndex = campaign.columns.findIndex(c => c.id === colId);
        return { rowIndex, colIndex };
    };

    // Helpers for range math
    const getRange = () => {
        if (!selection) return null;
        const start = getCoordinates(selection.startRowId, selection.startColId);
        const end = getCoordinates(selection.endRowId, selection.endColId);
        return {
            minRow: Math.min(start.rowIndex, end.rowIndex),
            maxRow: Math.max(start.rowIndex, end.rowIndex),
            minCol: Math.min(start.colIndex, end.colIndex),
            maxCol: Math.max(start.colIndex, end.colIndex),
        };
    };

    const isSelected = (rowId: string, colId: string) => {
        if (!selection) return false;
        // Optimization: Check IDs directly if single cell
        if (selection.startRowId === selection.endRowId && selection.startColId === selection.endColId) {
            return rowId === selection.startRowId && colId === selection.startColId;
        }

        // Full range check
        const range = getRange();
        if (!range) return false;

        // We need indices.
        const current = getCoordinates(rowId, colId);
        return current.rowIndex >= range.minRow && current.rowIndex <= range.maxRow &&
            current.colIndex >= range.minCol && current.colIndex <= range.maxCol;
    };

    const handleMouseDown = (rowId: string, colId: string) => {
        setIsDragging(true);
        setSelection({ startRowId: rowId, startColId: colId, endRowId: rowId, endColId: colId });
    };

    const handleMouseEnter = (rowId: string, colId: string) => {
        if (isDragging && selection) {
            setSelection({ ...selection, endRowId: rowId, endColId: colId });
        }
    };


    // --- Clipboard Logic ---

    // 1. Copy (Global Listener)
    useEffect(() => {
        const handleKeyDown = async (e: KeyboardEvent) => {
            // CTRL+C
            if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                const sel = selectionRef.current;
                if (!sel) return;

                // If user is editing text (cursor in input), default copy behavior handles it
                // UNLESS we want to copy the whole cell(s)
                // If range is > 1 cell, we assume table copy intent
                const isMulti = sel.startRowId !== sel.endRowId || sel.startColId !== sel.endColId;
                if (!isMulti) {
                    // Single cell: let browser handle it if focused? 
                    // Actually, for Excel feel, Ctrl+C on a cell copies the value even if not selecting text inside
                    // But standard input behavior needs selection.
                    // Let's force manual write if we are not "editing" (selection range existing usually implies "navigation mode" in Excel)
                    // But here we are always in "edit mode" (inputs).
                    // We'll trust browser default for single input.
                    if (document.activeElement?.tagName === 'INPUT') return;
                }

                e.preventDefault(); // Intercept

                // Get data from ref (latest typed)
                const range = getRangeFromRef(sel);
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

        // Helper specifically for Ref reading inside effect
        const getRangeFromRef = (sel: SelectionRange) => {
            const rIds = rowsRef.current.map(r => r.id);
            const cIds = colsRef.current.map(c => c.id);
            const r1 = rIds.indexOf(sel.startRowId);
            const r2 = rIds.indexOf(sel.endRowId);
            const c1 = cIds.indexOf(sel.startColId);
            const c2 = cIds.indexOf(sel.endColId);
            if (r1 === -1 || c1 === -1) return null;

            return {
                minRow: Math.min(r1, r2), maxRow: Math.max(r1, r2),
                minCol: Math.min(c1, c2), maxCol: Math.max(c1, c2)
            };
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // 2. Paste (Input Listener + Global)
    // We pass this handler to EACH input.
    const handlePaste = async (e: React.ClipboardEvent, rowId: string, colId: string) => {
        // e.target is the input.
        const clipboardData = e.clipboardData.getData('text');

        // Heuristic: If contains newline or tab, it's multi-cell paste -> Intercept
        // If it's simple text and we are just editing one cell -> Let default happen (or handle simply)
        if (clipboardData.includes('\n') || clipboardData.includes('\t')) {
            e.preventDefault();
            performBatchPaste(clipboardData, rowId, colId);
        }
        // Else: allow default native paste into the input
    };

    const performBatchPaste = async (text: string, startRowId: string, startColId: string) => {
        const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== "");
        if (lines.length === 0) return;

        const startCoords = getCoordinates(startRowId, startColId);
        const batch = writeBatch(db);
        let batchCount = 0;

        // Local Optimistic Update
        // We need to trigger re-render of affected cells. 
        // Since we are not using setRows for single typing, we MUST use setRows here for bulk update
        // This causes a big render but it's acceptable for a Paste action (once).

        const newRows = [...rows]; // Shallow copy

        lines.forEach((line, i) => {
            const values = line.split('\t');
            const targetRowIndex = startCoords.rowIndex + i;

            if (targetRowIndex < newRows.length) {
                const targetRow = newRows[targetRowIndex];
                const updates: any = {};
                const newDataMap = { ...targetRow.data };

                values.forEach((val, j) => {
                    const targetColIndex = startCoords.colIndex + j;
                    if (targetColIndex < campaign.columns.length) {
                        const colId = campaign.columns[targetColIndex].id;
                        updates[`data.${colId}`] = val.trim();
                        newDataMap[colId] = val.trim();
                    }
                });

                if (Object.keys(updates).length > 0) {
                    // Update Local
                    newRows[targetRowIndex] = { ...targetRow, data: newDataMap };

                    // Queue Firestore
                    const rowRef = doc(db, "campaign_rows", targetRow.id);
                    batch.update(rowRef, updates);
                    batchCount++;
                }
            }
        });

        setRows(newRows); // Update UI
        if (batchCount > 0) await batch.commit(); // Update DB
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
                                        onMouseDown={handleMouseDown}
                                        onMouseEnter={handleMouseEnter}
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
