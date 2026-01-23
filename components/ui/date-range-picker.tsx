"use client";

import { useState, useEffect, useRef } from "react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isWithinInterval, startOfDay, endOfDay, setHours, setMinutes, getHours, getMinutes, isValid, parse } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";
import { Input } from "./input";

interface DateRangePickerProps {
    startDate: Date | null;
    endDate: Date | null;
    onChange: (start: Date | null, end: Date | null) => void;
}

export function DateRangePicker({ startDate, endDate, onChange }: DateRangePickerProps) {
    const [isOpen, setIsOpen] = useState(false);

    // Internal state for the picker (committed only on "Aplicar" or could be instant)
    // The user requested "click anywhere on the range box". 
    // We'll mimic the range display.

    // If no dates provided, initialize internal with today? Or nulls.
    // The prompt says "intervals... custom".

    const containerRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const formatDisplayDate = (d: Date | null) => {
        if (!d) return "--/--/---- --:--";
        return format(d, "dd/MM/yyyy HH:mm");
    };

    return (
        <div className="relative" ref={containerRef}>
            {/* Trigger Box */}
            <div
                className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-md cursor-pointer hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
                onClick={() => setIsOpen(!isOpen)}
            >
                <CalendarIcon className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                    {startDate ? formatDisplayDate(startDate) : "Inicio"}
                </span>
                <span className="text-gray-400">-</span>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                    {endDate ? formatDisplayDate(endDate) : "Fin"}
                </span>
            </div>

            {/* Dropdown Content */}
            {isOpen && (
                <div className="absolute top-full right-0 mt-2 z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl p-4 flex flex-col gap-4 min-w-[620px]">
                    <div className="flex gap-6">
                        {/* Start Date Section */}
                        <div className="flex-1">
                            <h3 className="text-sm font-medium mb-3 text-gray-900 dark:text-white">Fecha de Inicio</h3>
                            <SingleDatePicker
                                date={startDate}
                                defaultTime="00:00"
                                onChange={(d) => onChange(d, endDate)}
                                maxDate={endDate || undefined}
                            />
                        </div>

                        <div className="w-px bg-gray-200 dark:bg-gray-800 self-stretch" />

                        {/* End Date Section */}
                        <div className="flex-1">
                            <h3 className="text-sm font-medium mb-3 text-gray-900 dark:text-white">Fecha de Fin</h3>
                            <SingleDatePicker
                                date={endDate}
                                defaultTime="23:59"
                                onChange={(d) => onChange(startDate, d)}
                                minDate={startDate || undefined}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

interface SingleDatePickerProps {
    date: Date | null;
    onChange: (date: Date) => void;
    minDate?: Date;
    maxDate?: Date;
    defaultTime: string;
}

function SingleDatePicker({ date, onChange, minDate, maxDate, defaultTime }: SingleDatePickerProps) {
    const [viewDate, setViewDate] = useState(date || new Date());
    const [timeInput, setTimeInput] = useState(date ? format(date, "HH:mm") : defaultTime);

    // Sync validation when date prop changes externally
    useEffect(() => {
        if (date) {
            setTimeInput(format(date, "HH:mm"));
            setViewDate(date);
        }
    }, [date]);

    // Calendar navigation
    const nextMonth = () => setViewDate(addMonths(viewDate, 1));
    const prevMonth = () => setViewDate(subMonths(viewDate, 1));

    // Time Input Handler
    const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value.replace(/[^0-9:]/g, ""); // Allow only numbers and colon
        if (val.length > 5) return;

        setTimeInput(val);

        // Auto-validate if complete 00:00
        if (val.length === 5 && val.includes(':')) {
            const [h, m] = val.split(':').map(Number);
            if (!isNaN(h) && !isNaN(m) && h >= 0 && h < 24 && m >= 0 && m < 60) {
                // Valid time
                applyTime(h, m);
            }
        }
    };

    const handleTimeBlur = () => {
        // Validate on blur
        if (!timeInput.includes(':') && timeInput.length <= 2) {
            // Maybe user typed just hour?
            const h = parseInt(timeInput);
            if (!isNaN(h) && h >= 0 && h < 24) {
                const newTime = `${h.toString().padStart(2, '0')}:00`;
                setTimeInput(newTime);
                applyTime(h, 0);
                return;
            }
        }

        const [hStr, mStr] = timeInput.split(':');
        let h = parseInt(hStr || "0");
        let m = parseInt(mStr || "0");

        if (isNaN(h)) h = 0;
        if (isNaN(m)) m = 0;

        // Clamp
        h = Math.max(0, Math.min(23, h));
        m = Math.max(0, Math.min(59, m));

        const formatted = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        setTimeInput(formatted);
        applyTime(h, m);
    };

    const applyTime = (h: number, m: number) => {
        const baseDate = date || new Date(); // If no date selected, assume today, but usually user selects date first? 
        // Logic: If date is null, use today effectively for the date part? 
        // Actually, if date is null, we shouldn't trigger onChange until they pick a day? 
        // Requirement says "default time... can edit...". 
        // Let's assume on time edit, if no date selected, we pick today's date.

        const newDate = setMinutes(setHours(baseDate, h), m);
        onChange(newDate);
    };

    const handleDayClick = (day: Date) => {
        // preserve current time input
        const [h, m] = timeInput.split(':').map(Number);
        const newDate = setMinutes(setHours(day, h || 0), m || 0);
        onChange(newDate);
    };

    // Generate days
    const monthStart = startOfMonth(viewDate);
    const monthEnd = endOfMonth(viewDate);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Padding days
    const startDayOfWeek = monthStart.getDay(); // 0 sunday
    // Shift to start week on Monday (1) or Sunday (0)? Locally (es) usually Monday.
    // getDay returns 0 for Sunday. 
    // Let's ensure Monday start: 0->6, 1->0, 2->1 ...
    const padding = Array.from({ length: (startDayOfWeek + 6) % 7 });

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between mb-2">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
                <span className="text-sm font-medium capitalize">{format(viewDate, "MMMM yyyy", { locale: es })}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
            </div>

            {/* Days Header */}
            <div className="grid grid-cols-7 text-xs text-center text-gray-400 mb-1">
                {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => <span key={d}>{d}</span>)}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
                {padding.map((_, i) => <div key={`pad-${i}`} />)}
                {days.map(day => {
                    const isSelected = date && isSameDay(day, date);
                    const isToday = isSameDay(day, new Date());
                    const isBlocked = (minDate && day < startOfDay(minDate)) || (maxDate && day > endOfDay(maxDate));

                    return (
                        <button
                            key={day.toISOString()}
                            disabled={!!isBlocked}
                            onClick={() => handleDayClick(day)}
                            className={cn(
                                "h-8 w-8 text-sm rounded-md flex items-center justify-center transition-colors",
                                isSelected ? "bg-blue-600 text-white" : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300",
                                isToday && !isSelected && "border border-blue-600 text-blue-600",
                                isBlocked && "opacity-25 cursor-not-allowed hover:bg-transparent"
                            )}
                        >
                            {format(day, "d")}
                        </button>
                    )
                })}
            </div>

            {/* Time Input */}
            <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-gray-500">Hora:</span>
                <Input
                    value={timeInput}
                    onChange={handleTimeChange}
                    onBlur={handleTimeBlur}
                    placeholder="HH:MM"
                    className="h-8 w-24 font-mono text-center"
                    maxLength={5}
                />
            </div>
        </div>
    );
}
