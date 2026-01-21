"use client";

import { useState, useEffect, useRef, memo, useCallback, useMemo } from "react";
import { Campaign, CampaignColumn, CampaignRow } from "@/types/campaign";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, MoreHorizontal, ArrowDown, Maximize2, Minimize2 } from "lucide-react";
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

type CellChange = {
    rowId: string;
    colId: string;
    oldValue: string;
    newValue: string;
};

type HistoryAction = {
    type: 'edit' | 'batch_edit' | 'clear' | 'paste';
    changes: CellChange[];
};

// ============================================================
// CELL COMPONENT - Completely Self-Managed State
// ============================================================
interface CellProps {
    rowId: string;
    colId: string;
    serverValue: string; // Value from Firestore (may be stale)
    isSelected: boolean;
    isDragging: boolean;
    onMouseDown: (rowId: string, colId: string) => void;
    onMouseEnter: (rowId: string, colId: string) => void;
    onCommit: (rowId: string, colId: string, oldVal: string, newVal: string) => void;
    onPaste: (e: React.ClipboardEvent, rowId: string, colId: string) => void;
}

const CampaignCell = memo(({
    rowId, colId, serverValue, isSelected, isDragging, onMouseDown, onMouseEnter, onCommit, onPaste
}: CellProps) => {
    // LOCAL state is the ONLY source of truth while editing
    const [localValue, setLocalValue] = useState(serverValue);
    const [isFocused, setIsFocused] = useState(false);
    const initialValueRef = useRef(serverValue); // Value when user started editing

    // ONLY sync from server when NOT focused (user is not editing)
    useEffect(() => {
        if (!isFocused) {
            setLocalValue(serverValue);
            initialValueRef.current = serverValue;
        }
    }, [serverValue, isFocused]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setLocalValue(e.target.value);
    };

    const handleFocus = () => {
        setIsFocused(true);
        initialValueRef.current = localValue; // Capture value at start of edit
    };

    const handleBlur = () => {
        setIsFocused(false);
        // Commit to parent if value changed during this edit session
        if (localValue !== initialValueRef.current) {
            onCommit(rowId, colId, initialValueRef.current, localValue);
        }
    };

    return (
        <td
            className={cn(
                "border-r border-b border-gray-300 dark:border-gray-600 p-0 relative cursor-cell",
                isSelected && "bg-blue-50/70 dark:bg-blue-500/20"
            )}
            onMouseDown={() => onMouseDown(rowId, colId)}
            onMouseEnter={() => onMouseEnter(rowId, colId)}
        >
            <input
                className={cn(
                    "w-full h-full px-2 py-2 border-none outline-none bg-transparent text-gray-900 dark:text-white text-sm",
                    isSelected && "bg-transparent"
                )}
                value={localValue}
                onChange={handleChange}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onPaste={(e) => onPaste(e, rowId, colId)}
                onKeyDown={(e) => {
                    // Let Ctrl+A propagate to window handler for select-all
                    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
                        e.preventDefault();
                    }
                }}
                style={{ pointerEvents: isDragging ? 'none' : 'auto' }}
            />
        </td>
    );
}, (prev, next) => {
    // Only re-render if server value changes AND we're not editing,
    // or if selection/dragging state changes
    return (
        prev.serverValue === next.serverValue &&
        prev.isSelected === next.isSelected &&
        prev.isDragging === next.isDragging
    );
});
CampaignCell.displayName = "CampaignCell";


// ============================================================
// MAIN TABLE COMPONENT
// ============================================================
export function CampaignTable({ campaign, onColumnsChange }: CampaignTableProps) {
    const [rows, setRows] = useState<CampaignRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [selection, setSelection] = useState<SelectionRange | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Refs for stable access in callbacks
    const rowsRef = useRef<CampaignRow[]>([]);
    const colsRef = useRef<CampaignColumn[]>([]);
    const selectionRef = useRef<SelectionRange | null>(null);
    const isDraggingRef = useRef(false);
    const historyRef = useRef<{ past: HistoryAction[], future: HistoryAction[] }>({ past: [], future: [] });
    const tableContainerRef = useRef<HTMLDivElement>(null);
    const mousePositionRef = useRef<{ x: number, y: number }>({ x: 0, y: 0 });
    const autoScrollRef = useRef<number | null>(null);

    // Sync Refs
    useEffect(() => { rowsRef.current = rows; }, [rows]);
    useEffect(() => { colsRef.current = campaign.columns; }, [campaign.columns]);
    useEffect(() => { selectionRef.current = selection; }, [selection]);
    useEffect(() => { isDraggingRef.current = isDragging; }, [isDragging]);

    // -------------------- AUTO-SCROLL ON DRAG --------------------
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            mousePositionRef.current = { x: e.clientX, y: e.clientY };
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    useEffect(() => {
        if (!isDragging) {
            if (autoScrollRef.current) {
                cancelAnimationFrame(autoScrollRef.current);
                autoScrollRef.current = null;
            }
            return;
        }

        const EDGE_THRESHOLD = 50; // pixels from edge to start scrolling
        const MAX_SPEED = 20; // max pixels per frame

        const autoScroll = () => {
            const container = tableContainerRef.current;
            if (!container || !isDraggingRef.current) return;

            const rect = container.getBoundingClientRect();
            const { x, y } = mousePositionRef.current;

            let scrollX = 0;
            let scrollY = 0;

            // Calculate scroll speed based on distance from edge
            if (y < rect.top + EDGE_THRESHOLD) {
                const distance = rect.top + EDGE_THRESHOLD - y;
                scrollY = -Math.min(MAX_SPEED, distance * 0.5);
            } else if (y > rect.bottom - EDGE_THRESHOLD) {
                const distance = y - (rect.bottom - EDGE_THRESHOLD);
                scrollY = Math.min(MAX_SPEED, distance * 0.5);
            }

            if (x < rect.left + EDGE_THRESHOLD) {
                const distance = rect.left + EDGE_THRESHOLD - x;
                scrollX = -Math.min(MAX_SPEED, distance * 0.5);
            } else if (x > rect.right - EDGE_THRESHOLD) {
                const distance = x - (rect.right - EDGE_THRESHOLD);
                scrollX = Math.min(MAX_SPEED, distance * 0.5);
            }

            if (scrollX !== 0 || scrollY !== 0) {
                container.scrollBy(scrollX, scrollY);

                // After scrolling, find which cell is under the cursor and update selection
                const element = document.elementFromPoint(x, y);
                if (element) {
                    // Find the closest td element
                    const td = element.closest('td');
                    if (td) {
                        // Get row and col from the data attributes or by traversing
                        const row = td.closest('tr');
                        const tbody = row?.closest('tbody');
                        if (row && tbody) {
                            const rowIndex = Array.from(tbody.children).indexOf(row);
                            const colIndex = Array.from(row.children).indexOf(td) - 1; // -1 for row number column

                            if (rowIndex >= 0 && colIndex >= 0 && rowIndex < rowsRef.current.length && colIndex < colsRef.current.length) {
                                const newRowId = rowsRef.current[rowIndex].id;
                                const newColId = colsRef.current[colIndex].id;

                                setSelection(prev => prev ? { ...prev, endRowId: newRowId, endColId: newColId } : null);
                            }
                        }
                    }
                }
            }

            autoScrollRef.current = requestAnimationFrame(autoScroll);
        };

        autoScrollRef.current = requestAnimationFrame(autoScroll);

        return () => {
            if (autoScrollRef.current) {
                cancelAnimationFrame(autoScrollRef.current);
            }
        };
    }, [isDragging]);

    // -------------------- DATA FETCHING --------------------
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

    // Auto-create rows if empty
    useEffect(() => {
        if (!loading && rows.length === 0) {
            handleBatchAddRows(100);
        }
    }, [loading, rows.length]);


    // -------------------- HISTORY MANAGEMENT --------------------
    const addToHistory = useCallback((action: HistoryAction) => {
        if (action.changes.length === 0) return;
        historyRef.current.past.push(action);
        historyRef.current.future = [];
        if (historyRef.current.past.length > 50) historyRef.current.past.shift();
    }, []);

    const performUndo = useCallback(async () => {
        const past = historyRef.current.past;
        if (past.length === 0) return;

        const action = past.pop()!;
        historyRef.current.future.push(action);

        const batch = writeBatch(db);
        action.changes.forEach(change => {
            batch.update(doc(db, "campaign_rows", change.rowId), { [`data.${change.colId}`]: change.oldValue });
        });
        await batch.commit();
    }, []);

    const performRedo = useCallback(async () => {
        const future = historyRef.current.future;
        if (future.length === 0) return;

        const action = future.pop()!;
        historyRef.current.past.push(action);

        const batch = writeBatch(db);
        action.changes.forEach(change => {
            batch.update(doc(db, "campaign_rows", change.rowId), { [`data.${change.colId}`]: change.newValue });
        });
        await batch.commit();
    }, []);


    // -------------------- COLUMN ACTIONS --------------------
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


    // -------------------- CELL COMMIT (on blur) --------------------
    const handleCellCommit = useCallback(async (rowId: string, colId: string, oldVal: string, newVal: string) => {
        // 1. Save to Firestore immediately
        const rowRef = doc(db, "campaign_rows", rowId);
        await updateDoc(rowRef, { [`data.${colId}`]: newVal });

        // 2. Add to history for undo
        addToHistory({
            type: 'edit',
            changes: [{ rowId, colId, oldValue: oldVal, newValue: newVal }]
        });
    }, [addToHistory]);


    // -------------------- PASTE LOGIC --------------------
    const handlePaste = useCallback(async (e: React.ClipboardEvent, rowId: string, colId: string) => {
        const clipboardData = e.clipboardData.getData('text');

        // Only intercept multi-cell paste (contains tabs or newlines)
        if (!clipboardData.includes('\n') && !clipboardData.includes('\t')) {
            return; // Let native paste handle single-value paste
        }

        e.preventDefault();

        const lines = clipboardData.split(/\r\n|\n/).filter(line => line.trim() !== "");
        if (lines.length === 0) return;

        const startRowIndex = rowsRef.current.findIndex(r => r.id === rowId);
        const startColIndex = colsRef.current.findIndex(c => c.id === colId);
        if (startRowIndex === -1 || startColIndex === -1) return;

        const batch = writeBatch(db);
        const historyChanges: CellChange[] = [];
        let batchCount = 0;

        lines.forEach((line, i) => {
            const values = line.split('\t');
            const targetRowIndex = startRowIndex + i;

            if (targetRowIndex < rowsRef.current.length) {
                const targetRow = rowsRef.current[targetRowIndex];
                const updates: Record<string, string> = {};

                values.forEach((val, j) => {
                    const targetColIndex = startColIndex + j;
                    if (targetColIndex < colsRef.current.length) {
                        const targetCol = colsRef.current[targetColIndex];
                        const oldVal = targetRow.data[targetCol.id] || "";
                        const newVal = val.trim();

                        if (oldVal !== newVal) {
                            updates[`data.${targetCol.id}`] = newVal;
                            historyChanges.push({
                                rowId: targetRow.id,
                                colId: targetCol.id,
                                oldValue: oldVal,
                                newValue: newVal
                            });
                        }
                    }
                });

                if (Object.keys(updates).length > 0) {
                    batch.update(doc(db, "campaign_rows", targetRow.id), updates);
                    batchCount++;
                }
            }
        });

        if (batchCount > 0) {
            await batch.commit();
            addToHistory({ type: 'paste', changes: historyChanges });
        }
    }, [addToHistory]);


    // -------------------- SELECTION LOGIC --------------------
    const handleMouseDown = useCallback((rowId: string, colId: string) => {
        setIsDragging(true);
        setSelection({ startRowId: rowId, startColId: colId, endRowId: rowId, endColId: colId });
    }, []);

    const handleMouseEnter = useCallback((rowId: string, colId: string) => {
        if (!isDraggingRef.current) return;
        setSelection((prev) => prev ? ({ ...prev, endRowId: rowId, endColId: colId }) : null);
    }, []);

    const getRange = useCallback(() => {
        const sel = selectionRef.current;
        if (!sel) return null;

        const r1 = rowsRef.current.findIndex(r => r.id === sel.startRowId);
        const r2 = rowsRef.current.findIndex(r => r.id === sel.endRowId);
        const c1 = colsRef.current.findIndex(c => c.id === sel.startColId);
        const c2 = colsRef.current.findIndex(c => c.id === sel.endColId);

        if (r1 === -1 || r2 === -1 || c1 === -1 || c2 === -1) return null;

        return {
            minRow: Math.min(r1, r2),
            maxRow: Math.max(r1, r2),
            minCol: Math.min(c1, c2),
            maxCol: Math.max(c1, c2),
        };
    }, []);

    // Precompute selected cell IDs as a Set for O(1) lookups (performance optimization)
    const selectedCellIds = useMemo(() => {
        const set = new Set<string>();
        if (!selection) return set;

        const r1 = rows.findIndex(r => r.id === selection.startRowId);
        const r2 = rows.findIndex(r => r.id === selection.endRowId);
        const c1 = campaign.columns.findIndex(c => c.id === selection.startColId);
        const c2 = campaign.columns.findIndex(c => c.id === selection.endColId);

        if (r1 === -1 || r2 === -1 || c1 === -1 || c2 === -1) return set;

        const minRow = Math.min(r1, r2);
        const maxRow = Math.max(r1, r2);
        const minCol = Math.min(c1, c2);
        const maxCol = Math.max(c1, c2);

        for (let i = minRow; i <= maxRow; i++) {
            for (let j = minCol; j <= maxCol; j++) {
                const rowId = rows[i]?.id;
                const colId = campaign.columns[j]?.id;
                if (rowId && colId) {
                    set.add(`${rowId}-${colId}`);
                }
            }
        }
        return set;
    }, [selection, rows, campaign.columns]);

    const isSelected = useCallback((rowId: string, colId: string) => {
        return selectedCellIds.has(`${rowId}-${colId}`);
    }, [selectedCellIds]);


    // -------------------- KEYBOARD SHORTCUTS (with Sticky Ctrl) --------------------
    // Track when Ctrl was last pressed for Excel-like timing tolerance
    const ctrlPressedAtRef = useRef<number>(0);
    const CTRL_GRACE_PERIOD = 500; // ms - increased for better tolerance

    useEffect(() => {
        const handleKeyDown = async (e: KeyboardEvent) => {
            // Track Ctrl press timestamp
            if (e.key === 'Control' || e.key === 'Meta') {
                ctrlPressedAtRef.current = Date.now();
            }

            // Check if Ctrl is active: currently held OR was pressed within grace period
            const ctrlWasRecentlyPressed = (Date.now() - ctrlPressedAtRef.current) < CTRL_GRACE_PERIOD;
            const isCtrlActive = e.ctrlKey || e.metaKey || ctrlWasRecentlyPressed;

            const sel = selectionRef.current;

            // Ctrl+Z - Undo
            if (isCtrlActive && e.key.toLowerCase() === 'z' && !e.shiftKey) {
                e.preventDefault();
                await performUndo();
                return;
            }

            // Ctrl+Y or Ctrl+Shift+Z - Redo
            if ((isCtrlActive && e.key.toLowerCase() === 'y') ||
                (isCtrlActive && e.shiftKey && e.key.toLowerCase() === 'z')) {
                e.preventDefault();
                await performRedo();
                return;
            }

            // Ctrl+A - Select All
            if (isCtrlActive && e.key === 'a') {
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

            // Backspace/Delete - Clear selected cells
            if (sel && (e.key === 'Backspace' || e.key === 'Delete')) {
                const isMulti = sel.startRowId !== sel.endRowId || sel.startColId !== sel.endColId;
                if (isMulti) {
                    e.preventDefault();

                    const range = getRange();
                    if (!range) return;

                    const batch = writeBatch(db);
                    const historyChanges: CellChange[] = [];
                    let batchCount = 0;

                    for (let i = range.minRow; i <= range.maxRow; i++) {
                        const targetRow = rowsRef.current[i];
                        const updates: Record<string, string> = {};

                        for (let j = range.minCol; j <= range.maxCol; j++) {
                            const colId = colsRef.current[j].id;
                            const oldVal = targetRow.data[colId] || "";
                            if (oldVal !== "") {
                                updates[`data.${colId}`] = "";
                                historyChanges.push({ rowId: targetRow.id, colId, oldValue: oldVal, newValue: "" });
                            }
                        }

                        if (Object.keys(updates).length > 0) {
                            batch.update(doc(db, "campaign_rows", targetRow.id), updates);
                            batchCount++;
                        }
                    }

                    if (batchCount > 0) {
                        await batch.commit();
                        addToHistory({ type: 'clear', changes: historyChanges });
                    }
                }
            }

            // Ctrl+C - Copy
            if (isCtrlActive && e.key === 'c') {
                if (!sel) return;
                const isMulti = sel.startRowId !== sel.endRowId || sel.startColId !== sel.endColId;
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
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [getRange, performUndo, performRedo, addToHistory]);


    // -------------------- RENDER --------------------
    const tableContent = (
        <div
            className={cn(
                "flex flex-col bg-white dark:bg-blue-500/10 shadow-sm overflow-hidden select-none outline-none",
                isFullscreen
                    ? "fixed inset-4 z-50 rounded-2xl border-2 border-gray-300 dark:border-blue-500/30"
                    : "h-full border border-gray-200 dark:border-blue-500/30 rounded-xl"
            )}
            onMouseUp={() => setIsDragging(false)}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Datos de la Campaña</h3>
                <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={addColumn} className="text-xs h-8 text-gray-900 dark:text-gray-100 hover:text-black dark:hover:text-white transition-all duration-200 hover:bg-gray-200/50 dark:hover:bg-gray-600/50 hover:scale-105 active:scale-95">
                        <Plus className="mr-2 h-3.5 w-3.5" /> Columna
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleBatchAddRows(100)} className="text-xs h-8 text-gray-900 dark:text-gray-100 hover:text-black dark:hover:text-white transition-all duration-200 hover:bg-gray-200/50 dark:hover:bg-gray-600/50 hover:scale-105 active:scale-95">
                        <ArrowDown className="mr-2 h-3.5 w-3.5" /> Añadir más filas
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setIsFullscreen(!isFullscreen)}
                        className="text-xs h-8 text-gray-900 dark:text-gray-100 hover:text-black dark:hover:text-white transition-all duration-200 hover:bg-gray-200/50 dark:hover:bg-gray-600/50 hover:scale-105 active:scale-95"
                    >
                        {isFullscreen ? (
                            <><Minimize2 className="mr-2 h-3.5 w-3.5" /> Minimizar</>
                        ) : (
                            <><Maximize2 className="mr-2 h-3.5 w-3.5" /> Expandir</>
                        )}
                    </Button>
                </div>
            </div>

            {/* Table */}
            <div ref={tableContainerRef} className="flex-1 overflow-auto relative">
                <table className="w-full text-sm border-collapse table-fixed">
                    <thead className="bg-gray-50 dark:bg-gray-800 z-10 sticky top-0">
                        <tr>
                            <th className="w-[40px] border-b border-r border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800"></th>
                            {campaign.columns.map((col) => (
                                <th key={col.id} className="w-[150px] border-b border-r border-gray-200 dark:border-gray-600 px-2 py-2 text-left bg-gray-50 dark:bg-gray-800">
                                    <div className="flex items-center justify-between group">
                                        <input
                                            className="bg-transparent border-none focus:ring-0 text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider w-full cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-1 py-0.5 transition-colors"
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
                                    <div className="text-[10px] text-gray-400 dark:text-gray-500 font-mono px-1">
                                        {'{{' + col.key + '}}'}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-900">
                        {rows.map((row, rowIndex) => (
                            <tr key={row.id}>
                                <td className="text-center text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800 border-r border-b border-gray-200 dark:border-gray-600">
                                    {rowIndex + 1}
                                </td>
                                {campaign.columns.map((col) => (
                                    <CampaignCell
                                        key={`${row.id}-${col.id}`}
                                        rowId={row.id}
                                        colId={col.id}
                                        serverValue={row.data[col.id] || ""}
                                        isSelected={isSelected(row.id, col.id)}
                                        isDragging={isDragging}
                                        onMouseDown={handleMouseDown}
                                        onMouseEnter={handleMouseEnter}
                                        onCommit={handleCellCommit}
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

    // If fullscreen, wrap in a backdrop
    if (isFullscreen) {
        return (
            <>
                <div
                    className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
                    onClick={() => setIsFullscreen(false)}
                />
                {tableContent}
            </>
        );
    }

    return tableContent;
}
