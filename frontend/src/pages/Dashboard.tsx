import React, { useState } from 'react';
import { Calendar, Check, Clock, Plus, GripVertical, Trash2 } from 'lucide-react';
import { Reorder, motion } from 'framer-motion';
import DatePicker from '../components/ui/DatePicker';

export default function Dashboard() {
    const [tasks, setTasks] = useState([
        { id: 999, title: 'Finish Lab Record - Machine Learning', date: 'Today, 5:00 PM', done: false, isUrgent: true },
        { id: 1, title: 'Complete Assignment 3 - Soft Skills I', date: 'Oct 20', done: false, isUrgent: false },
        { id: 2, title: 'Environmental Science Lab Record', date: 'Oct 22', done: false, isUrgent: false },
        { id: 3, title: 'Mathematics for Computing 4 Tutorial Sheet', date: 'Oct 24', done: false, isUrgent: false },
    ]);

    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskDate, setNewTaskDate] = useState<Date | null>(null);

    const toggleTask = (id: number) => {
        setTasks(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t));
    };

    const deleteTask = (id: number) => {
        setTasks(tasks.filter(t => t.id !== id));
    };

    const addTask = () => {
        if (!newTaskTitle) return;

        let formattedDate = 'No Date';
        if (newTaskDate) {
            formattedDate = new Intl.DateTimeFormat('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: 'numeric',
                hour12: true
            }).format(newTaskDate);
        }

        const newTask = {
            id: Date.now(),
            title: newTaskTitle,
            date: formattedDate,
            done: false,
            isUrgent: false
        };
        setTasks([...tasks, newTask]);
        setNewTaskTitle('');
        setNewTaskDate(null);
    };

    return (
        <div className="space-y-6">
            <header className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight text-white">The Board</h1>
                <div className="text-sm text-gray-400">Welcome back, Student</div>
            </header>

            <div className="grid grid-cols-1 gap-6">
                {/* Tasks Section - Full Width */}
                <div className="glass-card p-6 flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-primary flex items-center gap-2">
                            <Calendar size={20} />
                            Tasks
                        </h2>
                        <span className="text-xs text-gray-500">Drag to reorder</span>
                    </div>

                    {/* Add Task Form */}
                    <div className="flex flex-col sm:flex-row gap-2 mb-4 p-3 bg-white/5 rounded-lg border border-white/10 items-center">
                        <input
                            type="text"
                            value={newTaskTitle}
                            onChange={(e) => setNewTaskTitle(e.target.value)}
                            placeholder="Add new task..."
                            className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-500 text-sm py-1 w-full"
                            onKeyDown={(e) => e.key === 'Enter' && addTask()}
                        />
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <div className="w-40">
                                <DatePicker
                                    value={newTaskDate}
                                    onChange={setNewTaskDate}
                                    placeholder="Due Date"
                                />
                            </div>
                            <button
                                onClick={addTask}
                                className="text-primary hover:text-white transition-colors p-2 bg-primary/10 rounded-lg hover:bg-primary/20 border border-primary/20"
                            >
                                <Plus size={18} />
                            </button>
                        </div>
                    </div>

                    <Reorder.Group axis="y" values={tasks} onReorder={setTasks} className="space-y-3 flex-1">
                        {tasks.map((task) => (
                            <Reorder.Item key={task.id} value={task}>
                                <div
                                    className={`
                                        flex items-center justify-between group p-3 rounded sm:rounded-r-lg border-y border-r 
                                        transition-all cursor-grab active:cursor-grabbing
                                        ${task.isUrgent
                                            ? 'border-l-[4px] border-l-red-500 border-y-white/5 border-r-white/5 bg-white/[0.02]'
                                            : 'border-l-[4px] border-l-transparent border-y-transparent border-r-transparent hover:bg-white/5'
                                        }
                                    `}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="cursor-grab active:cursor-grabbing text-gray-600 group-hover:text-gray-400">
                                            <GripVertical size={16} />
                                        </div>
                                        <button
                                            onClick={() => toggleTask(task.id)}
                                            className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${task.done
                                                    ? 'bg-primary border-primary text-black'
                                                    : task.isUrgent ? 'border-red-400/50 hover:border-red-400' : 'border-gray-500 group-hover:border-primary'
                                                }`}
                                        >
                                            {task.done && <Check size={14} strokeWidth={3} />}
                                        </button>
                                        <span className={`
                                            ${task.done ? 'text-gray-500 line-through' : task.isUrgent ? 'text-white font-medium' : 'text-gray-200'}
                                        `}>
                                            {task.title}
                                            {task.isUrgent && <span className="ml-2 text-[10px] text-red-400 font-bold border border-red-400/30 px-1.5 py-0.5 rounded uppercase tracking-wider">Urgent</span>}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className={`text-sm flex items-center gap-1 ${task.isUrgent ? 'text-red-300/80' : 'text-gray-400'}`}>
                                            <Clock size={14} />
                                            {task.date}
                                        </div>
                                        <button onClick={() => deleteTask(task.id)} className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            </Reorder.Item>
                        ))}
                    </Reorder.Group>
                </div>
            </div>
        </div>
    );
}
