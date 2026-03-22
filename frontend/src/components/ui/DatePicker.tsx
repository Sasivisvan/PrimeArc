import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DatePickerProps {
    value: Date | null;
    onChange: (date: Date) => void;
    placeholder?: string;
}

export default function DatePicker({ value, onChange, placeholder = "Select Date" }: DatePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [viewDate, setViewDate] = useState(value || new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(value);
    const [time, setTime] = useState({
        hours: value ? value.getHours() : 12,
        minutes: value ? value.getMinutes() : 0
    });

    const containerRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Calendar Logic
    const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

    const currentYear = viewDate.getFullYear();
    const currentMonth = viewDate.getMonth();
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

    const changeMonth = (increment: number) => {
        setViewDate(new Date(currentYear, currentMonth + increment, 1));
    };

    const handleDateClick = (day: number) => {
        const newDate = new Date(currentYear, currentMonth, day, time.hours, time.minutes);
        setSelectedDate(newDate);
        onChange(newDate);
    };

    const handleTimeChange = (type: 'hours' | 'minutes', val: string) => {
        let newValue = parseInt(val);
        if (isNaN(newValue)) return;

        if (type === 'hours') {
            newValue = Math.max(0, Math.min(23, newValue));
            setTime(prev => ({ ...prev, hours: newValue }));
        } else {
            newValue = Math.max(0, Math.min(59, newValue));
            setTime(prev => ({ ...prev, minutes: newValue }));
        }

        if (selectedDate) {
            const newDate = new Date(selectedDate);
            newDate.setHours(type === 'hours' ? newValue : time.hours);
            newDate.setMinutes(type === 'minutes' ? newValue : time.minutes);
            setSelectedDate(newDate);
            onChange(newDate);
        }
    };

    const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const formatDisplayDate = (date: Date) => {
        return new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            hour12: true
        }).format(date);
    };

    return (
        <div className="relative" ref={containerRef}>
            {/* Input Trigger */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-sm w-full
                    ${isOpen ? 'border-primary bg-primary/10 text-white' : 'border-white/10 bg-white/5 text-gray-300 hover:border-white/20'}
                `}
            >
                <CalendarIcon size={16} className={isOpen ? 'text-primary' : 'text-gray-400'} />
                <span>{selectedDate ? formatDisplayDate(selectedDate) : placeholder}</span>
            </button>

            {/* Popover */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="absolute right-0 top-full mt-2 w-72 bg-[#0B1120] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-3 border-b border-white/5 bg-white/5">
                            <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white">
                                <ChevronLeft size={18} />
                            </button>
                            <span className="font-semibold text-white">
                                {monthNames[currentMonth]} {currentYear}
                            </span>
                            <button onClick={() => changeMonth(1)} className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white">
                                <ChevronRight size={18} />
                            </button>
                        </div>

                        <div className="p-3">
                            {/* Week Days */}
                            <div className="grid grid-cols-7 mb-2 text-center">
                                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                                    <span key={day} className="text-xs font-medium text-gray-500">{day}</span>
                                ))}
                            </div>

                            {/* Calendar Grid */}
                            <div className="grid grid-cols-7 gap-1 mb-4">
                                {Array.from({ length: firstDay }).map((_, i) => (
                                    <div key={`empty-${i}`} />
                                ))}
                                {Array.from({ length: daysInMonth }).map((_, i) => {
                                    const day = i + 1;
                                    const isSelected = selectedDate &&
                                        selectedDate.getDate() === day &&
                                        selectedDate.getMonth() === currentMonth &&
                                        selectedDate.getFullYear() === currentYear;
                                    const isToday =
                                        new Date().getDate() === day &&
                                        new Date().getMonth() === currentMonth &&
                                        new Date().getFullYear() === currentYear;

                                    return (
                                        <button
                                            key={day}
                                            onClick={() => handleDateClick(day)}
                                            className={`
                                                h-8 w-8 rounded-full text-sm flex items-center justify-center transition-all
                                                ${isSelected
                                                    ? 'bg-primary text-black font-bold shadow-glow-sm'
                                                    : isToday
                                                        ? 'bg-white/10 text-white border border-primary/50'
                                                        : 'text-gray-300 hover:bg-white/5 hover:text-white'
                                                }
                                            `}
                                        >
                                            {day}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Time Picker */}
                            <div className="border-t border-white/5 pt-3 flex items-center justify-center gap-2">
                                <Clock size={14} className="text-primary" />
                                <div className="flex items-center bg-white/5 rounded px-2 py-1 gap-1 border border-white/10">
                                    <input
                                        type="number"
                                        min="0"
                                        max="23"
                                        value={time.hours.toString().padStart(2, '0')}
                                        onChange={(e) => handleTimeChange('hours', e.target.value)}
                                        className="w-8 bg-transparent text-center outline-none text-white text-sm"
                                    />
                                    <span className="text-gray-500">:</span>
                                    <input
                                        type="number"
                                        min="0"
                                        max="59"
                                        value={time.minutes.toString().padStart(2, '0')}
                                        onChange={(e) => handleTimeChange('minutes', e.target.value)}
                                        className="w-8 bg-transparent text-center outline-none text-white text-sm"
                                    />
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
