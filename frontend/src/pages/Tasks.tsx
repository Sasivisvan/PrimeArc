import { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { Check, Calendar, Trash2 } from 'lucide-react';
import { apiUrl } from '../lib/api';

interface TaskItem {
    _id: string;
    title: string;
    description: string;
    completed: boolean;
    scope: 'personal' | 'class';
    classLevel?: number;
    createdBy: string;
    priority: 'Low' | 'Medium' | 'High';
    dueDate?: string;
    createdAt: string;
}

export default function Tasks() {
    const { classLevel, role, username } = useUser();
    const [tasks, setTasks] = useState<TaskItem[]>([]);
    
    // UI State
    const [activeFilter, setActiveFilter] = useState<'all' | 'personal' | 'class'>('all');
    const [showAddForm, setShowAddForm] = useState(false);
    const canCreateClassTask = role === 'Class Leader' || role === 'Teacher';
    
    // Form State
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
    const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
    const [taskScope, setTaskScope] = useState<'personal' | 'class'>('personal');

    const fetchTasks = async () => {
        try {
            // Fetch both personal and class tasks in one go or separately based on API
            const res = await fetch(apiUrl(`/api/tasks?classLevel=${classLevel}&username=${encodeURIComponent(username || '')}`));
            if (res.ok) {
                const data = await res.json();
                setTasks(data);
            }
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchTasks();
    }, [classLevel, username]);

    const handleAddTask = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch(apiUrl('/api/tasks'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    description,
                    scope: taskScope,
                    classLevel: taskScope === 'class' ? classLevel : undefined,
                    createdBy: username,
                    priority,
                    dueDate: dueDate || undefined
                })
            });
            
            if (!res.ok) {
                const data = await res.json();
                alert(`Failed to add task: ${data.error || 'Server error'}\n${data.details || 'Please check MongoDB IP whitelist.'}`);
                return;
            }

            setTitle('');
            setDescription('');
            setPriority('Medium');
            setDueDate('');
            setTaskScope('personal');
            setShowAddForm(false);
            fetchTasks();
        } catch (err: any) {
            console.error(err);
            alert(`Failed to add task: ${err.message || 'Network error'}`);
        }
    };

    const toggleStatus = async (id: string, currentStatus: boolean) => {
        try {
            const res = await fetch(apiUrl(`/api/tasks/${id}`), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ completed: !currentStatus, username })
            });
            
            if (!res.ok) {
                const data = await res.json();
                alert(`Failed to update task: ${data.error || 'Server error'}`);
                return;
            }
            
            fetchTasks(); // Refresh list to get updated status
        } catch (err: any) {
            console.error(err);
            alert(`Network error: ${err.message}`);
        }
    };

    const handleDeleteTask = async (id: string, taskTitle: string) => {
        if (!window.confirm(`Delete task "${taskTitle}"?`)) return;
        try {
            const res = await fetch(apiUrl(`/api/tasks/${id}`), {
                method: 'DELETE',
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                alert(`Failed to delete task: ${data.error || 'Server error'}`);
                return;
            }

            fetchTasks();
        } catch (err: any) {
            console.error(err);
            alert(`Network error: ${err.message}`);
        }
    };

    const handleToggleAddForm = () => {
        if (!showAddForm) {
            setTaskScope(canCreateClassTask && activeFilter === 'class' ? 'class' : 'personal');
        }
        setShowAddForm(prev => !prev);
    };

    // Filter tasks based on the active filter
    const filteredTasks = tasks.filter(t => {
        const isPersonalTask = t.scope === 'personal' && t.createdBy === username;
        const isClassTask = t.scope === 'class';
        if (activeFilter === 'personal') return isPersonalTask;
        if (activeFilter === 'class') return isClassTask;
        return isPersonalTask || isClassTask;
    });

    const getPriorityColor = (p: string) => {
        switch(p) {
            case 'High': return '#ffffff'; // White
            case 'Medium': return '#aaaaaa'; // Gray
            case 'Low': return '#666666'; // Darker gray
            default: return '#888';
        }
    };

    const getScopeTheme = (scope: TaskItem['scope']) => {
        if (scope === 'class') {
            return {
                accent: '#60a5fa',
                badgeBg: 'rgba(96, 165, 250, 0.16)',
                badgeText: '#bfdbfe',
                badgeLabel: `Class ${classLevel}`,
                cardBg: 'linear-gradient(135deg, rgba(17, 24, 39, 0.96), rgba(10, 10, 10, 0.96))'
            };
        }

        return {
            accent: '#34d399',
            badgeBg: 'rgba(52, 211, 153, 0.16)',
            badgeText: '#a7f3d0',
            badgeLabel: 'Personal',
            cardBg: 'linear-gradient(135deg, rgba(10, 10, 10, 0.96), rgba(20, 29, 24, 0.96))'
        };
    };

    const sortTasksByPriority = (a: TaskItem, b: TaskItem) => {
        const pMap = { High: 3, Medium: 2, Low: 1 };
        return (pMap[b.priority] || 0) - (pMap[a.priority] || 0);
    };

    const activeTasks = filteredTasks
        .filter((task) => !task.completed)
        .sort(sortTasksByPriority);

    const completedTasks = filteredTasks
        .filter((task) => task.completed)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const renderTaskCard = (task: TaskItem) => {
        const scopeTheme = getScopeTheme(task.scope);
        const canDeleteTask = task.scope === 'class' && canCreateClassTask;

        return (
            <div
                key={task._id}
                style={{
                    background: scopeTheme.cardBg,
                    border: '1px solid rgba(255,255,255,0.08)',
                    padding: '20px',
                    borderRadius: '12px',
                    display: 'flex',
                    gap: '20px',
                    alignItems: 'flex-start',
                    borderLeft: `5px solid ${scopeTheme.accent}`,
                    boxShadow: `0 10px 30px ${scopeTheme.badgeBg}`,
                    opacity: task.completed ? 0.6 : 1,
                    transition: 'all 0.3s'
                }}
            >
                <div
                    onClick={() => toggleStatus(task._id, task.completed)}
                    style={{
                        width: '28px', height: '28px', borderRadius: '50%',
                        border: `2px solid ${task.completed ? scopeTheme.accent : '#666'}`,
                        backgroundColor: task.completed ? scopeTheme.accent : 'transparent',
                        display: 'flex', justifyContent: 'center', alignItems: 'center',
                        cursor: 'pointer', flexShrink: 0, marginTop: '2px'
                    }}
                    title={task.completed ? 'Mark as incomplete' : 'Mark as complete'}
                >
                    {task.completed && <span style={{ color: '#000', display: 'inline-flex' }}><Check size={16} /></span>}
                </div>

                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: '220px' }}>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                                <span style={{ fontSize: '0.75rem', padding: '4px 10px', backgroundColor: scopeTheme.badgeBg, borderRadius: '999px', color: scopeTheme.badgeText, fontWeight: 'bold', letterSpacing: '0.03em' }}>
                                    {scopeTheme.badgeLabel}
                                </span>
                                <span style={{ fontSize: '0.75rem', padding: '4px 10px', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '999px', color: '#d1d5db', fontWeight: 'bold' }}>
                                    {task.scope === 'class' ? 'Shared' : 'Private'}
                                </span>
                                {task.completed && (
                                    <span style={{ fontSize: '0.75rem', padding: '4px 10px', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '999px', color: '#bbb', fontWeight: 'bold' }}>
                                        Completed
                                    </span>
                                )}
                            </div>
                            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.3rem', textDecoration: task.completed ? 'line-through' : 'none', color: task.completed ? '#888' : 'white' }}>
                                {task.title}
                            </h3>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            {task.dueDate && (
                                <span style={{ fontSize: '0.85rem', padding: '4px 10px', backgroundColor: '#333', borderRadius: '12px', color: '#ccc', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <Calendar size={14} /> {new Date(task.dueDate).toLocaleDateString()}
                                </span>
                            )}
                            <span style={{ fontSize: '0.85rem', padding: '4px 10px', backgroundColor: `${getPriorityColor(task.priority)}33`, borderRadius: '12px', color: getPriorityColor(task.priority), fontWeight: 'bold' }}>
                                {task.priority}
                            </span>
                            {canDeleteTask && (
                                <button
                                    type="button"
                                    onClick={() => handleDeleteTask(task._id, task.title)}
                                    style={{ padding: '7px', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.35)', backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#fca5a5', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                    title="Delete class task"
                                >
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </div>
                    </div>

                    {task.description && (
                        <p style={{ margin: '0 0 12px 0', color: '#aaa', textDecoration: task.completed ? 'line-through' : 'none', fontSize: '0.95rem', lineHeight: '1.5' }}>
                            {task.description}
                        </p>
                    )}

                    <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '10px' }}>
                        Assigned by <span style={{ color: '#ccc' }}>{task.createdBy}</span>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div style={{ padding: '20px', color: 'white', maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '30px' }}>
                <div>
                    <h1 style={{ fontSize: '2.5rem', margin: 0 }}>Tasks</h1>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                        <button 
                            onClick={() => setActiveFilter('all')}
                            style={{ padding: '10px 20px', borderRadius: '30px', backgroundColor: activeFilter === 'all' ? '#fff' : '#333', color: activeFilter === 'all' ? '#000' : 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                            All Tasks
                        </button>
                        <button 
                            onClick={() => setActiveFilter('personal')}
                            style={{ padding: '10px 20px', borderRadius: '30px', backgroundColor: activeFilter === 'personal' ? '#2a3e34' : '#333', color: activeFilter === 'personal' ? '#a7f3d0' : 'white', border: activeFilter === 'personal' ? '1px solid rgba(52, 211, 153, 0.55)' : 'none', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                            Personal
                        </button>
                        <button 
                            onClick={() => setActiveFilter('class')}
                            style={{ padding: '10px 20px', borderRadius: '30px', backgroundColor: activeFilter === 'class' ? '#1f3147' : '#333', color: activeFilter === 'class' ? '#bfdbfe' : 'white', border: activeFilter === 'class' ? '1px solid rgba(96, 165, 250, 0.55)' : 'none', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                            {classLevel} Class
                        </button>
                    </div>
                </div>

                <button 
                    onClick={handleToggleAddForm}
                    style={{ padding: '15px 25px', backgroundColor: '#fff', border: 'none', borderRadius: '10px', color: '#000', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.1rem', boxShadow: '0 4px 15px rgba(255, 255, 255, 0.2)' }}
                >
                    {showAddForm ? 'Cancel' : 'Add Task'}
                </button>
            </div>

            {showAddForm && (
                <form onSubmit={handleAddTask} style={{ backgroundColor: '#111', padding: '25px', borderRadius: '15px', marginBottom: '30px', display: 'flex', flexDirection: 'column', gap: '15px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', border: '1px solid #333' }}>
                    <h3 style={{ margin: '0 0 10px 0', color: '#fff' }}>
                        Create a task
                    </h3>

                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <button
                            type="button"
                            onClick={() => setTaskScope('personal')}
                            style={{ padding: '10px 16px', borderRadius: '999px', border: taskScope === 'personal' ? '1px solid rgba(52, 211, 153, 0.65)' : '1px solid #444', backgroundColor: taskScope === 'personal' ? 'rgba(52, 211, 153, 0.16)' : 'transparent', color: taskScope === 'personal' ? '#a7f3d0' : '#bbb', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                            Personal Task
                        </button>
                        <button
                            type="button"
                            onClick={() => canCreateClassTask && setTaskScope('class')}
                            disabled={!canCreateClassTask}
                            style={{ padding: '10px 16px', borderRadius: '999px', border: taskScope === 'class' ? '1px solid rgba(96, 165, 250, 0.65)' : '1px solid #444', backgroundColor: taskScope === 'class' ? 'rgba(96, 165, 250, 0.16)' : 'transparent', color: taskScope === 'class' ? '#bfdbfe' : '#bbb', cursor: canCreateClassTask ? 'pointer' : 'not-allowed', fontWeight: 'bold', opacity: canCreateClassTask ? 1 : 0.45 }}
                        >
                            Class Task
                        </button>
                    </div>
                    {!canCreateClassTask && (
                        <p style={{ margin: 0, color: '#777', fontSize: '0.9rem' }}>
                            Class tasks can only be created by the class leader or teacher.
                        </p>
                    )}
                    
                    <input 
                        type="text" placeholder="Task Title" required 
                        value={title} onChange={e => setTitle(e.target.value)} 
                        style={{ padding: '15px', borderRadius: '8px', border: '1px solid #444', backgroundColor: '#000', color: 'white', fontSize: '1.1rem' }} 
                    />
                    <textarea 
                        placeholder="Description (optional)" rows={3}
                        value={description} onChange={e => setDescription(e.target.value)} 
                        style={{ padding: '15px', borderRadius: '8px', border: '1px solid #444', backgroundColor: '#000', color: 'white', fontSize: '1rem', resize: 'vertical' }} 
                    />
                    
                    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: '200px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', color: '#888' }}>Priority</label>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                {['Low', 'Medium', 'High'].map(p => (
                                    <button
                                        key={p} type="button"
                                        onClick={() => setPriority(p as any)}
                                        style={{ flex: 1, padding: '10px', borderRadius: '8px', border: `2px solid ${priority === p ? getPriorityColor(p) : '#444'}`, backgroundColor: priority === p ? `${getPriorityColor(p)}33` : 'transparent', color: priority === p ? getPriorityColor(p) : '#888', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s' }}
                                    >
                                        {p}
                                    </button>
                                ))}
                            </div>
                        </div>
                        
                        <div style={{ flex: 1, minWidth: '200px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', color: '#888' }}>Due Date (Optional)</label>
                            <input 
                                type="date" 
                                value={dueDate} onChange={e => setDueDate(e.target.value)}
                                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: '#1a1a25', color: 'white', fontSize: '1rem', boxSizing: 'border-box' }}
                            />
                        </div>
                    </div>
                    
                    <button type="submit" style={{ padding: '15px', backgroundColor: '#fff', color: '#000', fontWeight: 'bold', fontSize: '1.1rem', border: 'none', borderRadius: '8px', cursor: 'pointer', marginTop: '10px' }}>
                        Save Task
                    </button>
                </form>
            )}

            {/* Tasks List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                {activeTasks.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.3rem', color: '#fff' }}>Active Tasks</h2>
                            <p style={{ margin: '6px 0 0 0', color: '#777', fontSize: '0.95rem' }}>Open work that still needs attention.</p>
                        </div>
                        {activeTasks.map(renderTaskCard)}
                    </div>
                )}

                {completedTasks.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.3rem', color: '#fff' }}>Completed Tasks</h2>
                            <p style={{ margin: '6px 0 0 0', color: '#777', fontSize: '0.95rem' }}>Completed items stay here. Click the check control to mark one incomplete again.</p>
                        </div>
                        {completedTasks.map(renderTaskCard)}
                    </div>
                )}

                {activeTasks.length === 0 && completedTasks.length === 0 && (
                   <p style={{ textAlign: 'center', color: '#666', marginTop: '40px', fontSize: '1.1rem' }}>
                       {activeFilter === 'class'
                            ? `No class tasks for ${classLevel} yet.`
                            : activeFilter === 'personal'
                                ? 'You have no personal tasks yet.'
                                : 'No tasks yet.'}
                   </p>
                )}
            </div>
        </div>
    );
}
