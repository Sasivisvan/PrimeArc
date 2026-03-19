import { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';

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
    const [activeTab, setActiveTab] = useState<'personal' | 'class'>('personal');
    const [showAddForm, setShowAddForm] = useState(false);
    
    // Form State
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
    const [dueDate, setDueDate] = useState('');

    const fetchTasks = async () => {
        try {
            // Fetch both personal and class tasks in one go or separately based on API
            const res = await fetch(`http://localhost:5000/api/tasks?classLevel=${classLevel}`);
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
    }, [classLevel]);

    const handleAddTask = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await fetch('http://localhost:5000/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    description,
                    scope: activeTab,
                    classLevel: activeTab === 'class' ? classLevel : undefined,
                    createdBy: username,
                    priority,
                    dueDate: dueDate || undefined
                })
            });
            setTitle('');
            setDescription('');
            setPriority('Medium');
            setDueDate('');
            setShowAddForm(false);
            fetchTasks();
        } catch (err) {
            console.error(err);
        }
    };

    const toggleStatus = async (id: string, currentStatus: boolean) => {
        try {
            await fetch(`http://localhost:5000/api/tasks/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ completed: !currentStatus })
            });
            fetchTasks(); // Refresh list to get updated status
        } catch (err) {
            console.error(err);
        }
    };

    // Filter tasks based on the active tab
    const filteredTasks = tasks.filter(t => {
        if (activeTab === 'personal') return t.scope === 'personal';
        if (activeTab === 'class') return t.scope === 'class';
        return false;
    });

    const getPriorityColor = (p: string) => {
        switch(p) {
            case 'High': return '#ff4d4d'; // Red
            case 'Medium': return '#f59e0b'; // Orange
            case 'Low': return '#4ade80'; // Green
            default: return '#888';
        }
    };

    // Sorted by incomplete first, then priority (High > Medium > Low)
    const sortedTasks = [...filteredTasks].sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        const pMap = { High: 3, Medium: 2, Low: 1 };
        return (pMap[b.priority] || 0) - (pMap[a.priority] || 0);
    });

    return (
        <div style={{ padding: '20px', color: 'white', maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '30px' }}>
                <div>
                    <h1 style={{ fontSize: '2.5rem', margin: 0 }}>Tasks</h1>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                        <button 
                            onClick={() => setActiveTab('personal')}
                            style={{ padding: '10px 20px', borderRadius: '30px', backgroundColor: activeTab === 'personal' ? '#b14fff' : '#333', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                            My Personal Tasks
                        </button>
                        <button 
                            onClick={() => setActiveTab('class')}
                            style={{ padding: '10px 20px', borderRadius: '30px', backgroundColor: activeTab === 'class' ? '#4ade80' : '#333', color: activeTab === 'class' ? '#111' : 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                            Class {classLevel} Updates
                        </button>
                    </div>
                </div>

                {/* Only visually show add button if user can add */}
                {(activeTab === 'personal' || (activeTab === 'class' && role === 'Class Leader')) && (
                    <button 
                        onClick={() => setShowAddForm(!showAddForm)}
                        style={{ padding: '15px 25px', backgroundColor: '#4a90e2', border: 'none', borderRadius: '10px', color: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.1rem', boxShadow: '0 4px 15px rgba(74, 144, 226, 0.4)' }}
                    >
                        {showAddForm ? '✕ Cancel' : '+ Add Task'}
                    </button>
                )}
            </div>

            {showAddForm && (activeTab === 'personal' || role === 'Class Leader') && (
                <form onSubmit={handleAddTask} style={{ backgroundColor: '#2a2a35', padding: '25px', borderRadius: '15px', marginBottom: '30px', display: 'flex', flexDirection: 'column', gap: '15px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                    <h3 style={{ margin: '0 0 10px 0', color: activeTab === 'class' ? '#4ade80' : '#b14fff' }}>
                        Create a {activeTab === 'class' ? 'Class update' : 'Personal task'}
                    </h3>
                    
                    <input 
                        type="text" placeholder="Task Title" required 
                        value={title} onChange={e => setTitle(e.target.value)} 
                        style={{ padding: '15px', borderRadius: '8px', border: 'none', backgroundColor: '#1a1a25', color: 'white', fontSize: '1.1rem' }} 
                    />
                    <textarea 
                        placeholder="Description (optional)" rows={3}
                        value={description} onChange={e => setDescription(e.target.value)} 
                        style={{ padding: '15px', borderRadius: '8px', border: 'none', backgroundColor: '#1a1a25', color: 'white', fontSize: '1rem', resize: 'vertical' }} 
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
                    
                    <button type="submit" style={{ padding: '15px', backgroundColor: activeTab === 'class' ? '#4ade80' : '#b14fff', color: activeTab === 'class' ? '#111' : 'white', fontWeight: 'bold', fontSize: '1.1rem', border: 'none', borderRadius: '8px', cursor: 'pointer', marginTop: '10px' }}>
                        Save Task
                    </button>
                </form>
            )}

            {/* Tasks List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                {sortedTasks.map(task => (
                    <div 
                        key={task._id} 
                        style={{ 
                            backgroundColor: '#1a1a25', 
                            padding: '20px', 
                            borderRadius: '12px', 
                            display: 'flex', 
                            gap: '20px', 
                            alignItems: 'flex-start',
                            borderLeft: `5px solid ${getPriorityColor(task.priority)}`,
                            opacity: task.completed ? 0.6 : 1,
                            transition: 'all 0.3s'
                        }}
                    >
                        <div 
                            onClick={() => toggleStatus(task._id, task.completed)}
                            style={{ 
                                width: '28px', height: '28px', borderRadius: '50%', 
                                border: `2px solid ${task.completed ? '#4ade80' : '#666'}`, 
                                backgroundColor: task.completed ? '#4ade80' : 'transparent',
                                display: 'flex', justifyContent: 'center', alignItems: 'center', 
                                cursor: 'pointer', flexShrink: 0, marginTop: '2px'
                            }}
                        >
                            {task.completed && <span style={{ color: '#111', fontWeight: 'bold', fontSize: '1.2rem' }}>✓</span>}
                        </div>
                        
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <h3 style={{ margin: '0 0 8px 0', fontSize: '1.3rem', textDecoration: task.completed ? 'line-through' : 'none', color: task.completed ? '#888' : 'white' }}>
                                    {task.title}
                                </h3>
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                    {task.dueDate && (
                                        <span style={{ fontSize: '0.85rem', padding: '4px 10px', backgroundColor: '#333', borderRadius: '12px', color: '#ccc', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            📅 {new Date(task.dueDate).toLocaleDateString()}
                                        </span>
                                    )}
                                    <span style={{ fontSize: '0.85rem', padding: '4px 10px', backgroundColor: `${getPriorityColor(task.priority)}33`, borderRadius: '12px', color: getPriorityColor(task.priority), fontWeight: 'bold' }}>
                                        {task.priority}
                                    </span>
                                </div>
                            </div>
                            
                            {task.description && (
                                <p style={{ margin: '0 0 12px 0', color: '#aaa', textDecoration: task.completed ? 'line-through' : 'none', fontSize: '0.95rem', lineHeight: '1.5' }}>
                                    {task.description}
                                </p>
                            )}
                            
                            <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '10px' }}>
                                Assigned by <span style={{ color: activeTab === 'class' ? '#4ade80' : '#b14fff' }}>{task.createdBy}</span>
                            </div>
                        </div>
                    </div>
                ))}

                {sortedTasks.length === 0 && (
                   <p style={{ textAlign: 'center', color: '#666', marginTop: '40px', fontSize: '1.1rem' }}>
                       {activeTab === 'personal' ? "You have no personal tasks. Enjoy your day! 🎉" : `No updates for Class ${classLevel} yet.`}
                   </p>
                )}
            </div>
        </div>
    );
}
