import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import "./App.css";

import Chat from "./pages/Chat";
import Tasks from "./pages/Tasks";
import Notes from "./pages/Notes";
import MyResources from "./pages/MyResources";
import Content from "./pages/Content";
import Community from "./pages/Community";
import StudyTube from "./pages/StudyTube";
import Quizzes from "./pages/Quizzes";
import TeacherAdmin from "./pages/TeacherAdmin";
import Login from "./pages/Login";
import { UserProvider, useUser } from "./context/UserContext";

const Navbar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const currentPath = location.pathname;
    const { classLevel, setClassLevel, role, setRole } = useUser();
    
    // Auth Modal State
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [authPassword, setAuthPassword] = useState('');
    
    // Custom Dropdown State
    const [classDropdownOpen, setClassDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setClassDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleAuthSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (authPassword === "primearc2026") {
            setRole('Class Leader');
            setShowAuthModal(false);
            setAuthPassword('');
        } else {
            alert("Incorrect Password! Access denied.");
        }
    };

    return (
        <nav className="top-nav-bar" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', height: 'auto', minHeight: '65px', padding: '15px 30px', gap: '20px' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div className="brand-title" onClick={() => navigate("/")} style={{ cursor: 'pointer', margin: '0 20px 0 0' }}>PrimeArc</div>
                <div className="nav-links" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    <button className={`nav-btn ${currentPath === '/' ? 'active' : ''}`} onClick={() => navigate("/")}>💬 Chat</button>
                    <button className={`nav-btn ${currentPath === '/content' ? 'active' : ''}`} onClick={() => navigate("/content")}>📚 Content</button>
                    <button className={`nav-btn ${currentPath === '/tasks' ? 'active' : ''}`} onClick={() => navigate("/tasks")}>✅ Tasks</button>
                    <button className={`nav-btn ${currentPath === '/notes' ? 'active' : ''}`} onClick={() => navigate("/notes")}>📝 Notes</button>
                    <button className={`nav-btn ${currentPath === '/community' ? 'active' : ''}`} onClick={() => navigate("/community")}>👥 Q&A</button>
                    <button className={`nav-btn ${currentPath === '/quizzes' ? 'active' : ''}`} onClick={() => navigate("/quizzes")}>🧠 Quiz</button>
                    <button className={`nav-btn ${currentPath === '/studytube' ? 'active' : ''}`} onClick={() => navigate("/studytube")}>▶️ StudyTube</button>
                    <button className={`nav-btn ${currentPath === '/MyResources' ? 'active' : ''}`} onClick={() => navigate("/MyResources")}>🔗 Resources</button>
                </div>
            </div>
            
            <div className="profile-selector" style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'center', backgroundColor: '#1a1a25', padding: '8px 20px', borderRadius: '30px' }}>
                
                {/* Custom Class Dropdown */}
                <div style={{ position: 'relative' }} ref={dropdownRef}>
                    <div 
                        onClick={() => setClassDropdownOpen(!classDropdownOpen)}
                        style={{ padding: '8px 16px', borderRadius: '15px', backgroundColor: '#333', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid #444', transition: 'all 0.2s', minWidth: '115px', justifyContent: 'space-between', fontWeight: 'bold' }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = '#b14fff'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = '#444'}
                    >
                        <span>Class {classLevel}</span>
                        <span style={{ fontSize: '0.8rem', opacity: 0.7, transform: classDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</span>
                    </div>
                    
                    {classDropdownOpen && (
                        <div style={{ position: 'absolute', top: 'calc(100% + 10px)', right: 0, width: '130px', backgroundColor: '#2a2a35', borderRadius: '12px', border: '1px solid #555', boxShadow: '0 10px 40px rgba(0,0,0,0.6)', overflow: 'hidden', zIndex: 1000, display: 'flex', flexDirection: 'column', maxHeight: '350px', overflowY: 'auto', animation: 'fadeIn 0.2s ease' }}>
                            {[...Array(12)].map((_, i) => (
                                <div 
                                    key={i+1}
                                    onClick={() => { setClassLevel(i+1); setClassDropdownOpen(false); }}
                                    style={{ padding: '12px 18px', cursor: 'pointer', color: classLevel === i+1 ? '#00e5ff' : '#ccc', backgroundColor: classLevel === i+1 ? 'rgba(0, 229, 255, 0.1)' : 'transparent', borderBottom: i < 11 ? '1px solid #333' : 'none', transition: '0.2s', fontWeight: classLevel === i+1 ? 'bold' : 'normal' }}
                                    onMouseEnter={e => e.currentTarget.style.backgroundColor = classLevel === i+1 ? 'rgba(0, 229, 255, 0.2)' : '#444'}
                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = classLevel === i+1 ? 'rgba(0, 229, 255, 0.1)' : 'transparent'}
                                >
                                    Class {i+1}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderLeft: '1px solid #444', paddingLeft: '20px' }}>
                    <span style={{ fontSize: '0.9rem', color: '#aaa', fontWeight: 'bold' }}>Demo Mode: Class Leader</span>
                    <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px' }}>
                        <input 
                            type="checkbox" 
                            checked={role === 'Class Leader'} 
                            onChange={(e) => {
                                if (e.target.checked) {
                                    setShowAuthModal(true);
                                } else {
                                    setRole('Student');
                                }
                            }}
                            style={{ opacity: 0, width: 0, height: 0 }} 
                        />
                        <span style={{ 
                            position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, 
                            backgroundColor: role === 'Class Leader' ? '#4ade80' : '#555', 
                            transition: '0.4s', borderRadius: '34px' 
                        }}>
                            <span style={{ 
                                position: 'absolute', content: '""', height: '18px', width: '18px', 
                                left: role === 'Class Leader' ? '23px' : '3px', bottom: '3px', 
                                backgroundColor: 'white', transition: '0.4s', borderRadius: '50%', boxShadow: '0 2px 5px rgba(0,0,0,0.3)'
                            }} />
                        </span>
                    </label>
                </div>
            </div>

            {/* Custom Auth Modal (Rendered fixed via Portal to escape CSS backdrop-filter constraints and perfectly center on body) */}
            {showAuthModal && createPortal(
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}>
                    <div style={{ backgroundColor: '#2a2a35', padding: '35px', borderRadius: '20px', width: '90%', maxWidth: '400px', boxShadow: '0 15px 50px rgba(0,0,0,0.6)', animation: 'slideIn 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)' }}>
                        <h3 style={{ margin: '0 0 15px 0', color: 'white', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '1.8rem' }}>🔐</span> <span style={{ fontSize: '1.4rem' }}>Security Check</span>
                        </h3>
                        <p style={{ color: '#aaa', fontSize: '1rem', marginBottom: '25px', lineHeight: '1.5' }}>
                            Enter the Class Leader global access password to enable Demo Mode. <br/><span style={{ fontSize: '0.85rem', color: '#888' }}>(Hint: primearc2026)</span>
                        </p>
                        <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <input 
                                type="password" required autoFocus placeholder="Enter password..." 
                                value={authPassword} onChange={e => setAuthPassword(e.target.value)}
                                style={{ padding: '15px', borderRadius: '10px', border: '1px solid #555', backgroundColor: '#1a1a25', color: 'white', fontSize: '1.1rem' }}
                            />
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
                                <button type="button" onClick={() => { setShowAuthModal(false); setAuthPassword(''); }} style={{ padding: '12px 20px', backgroundColor: 'transparent', color: '#ccc', border: 'none', cursor: 'pointer', fontSize: '1.05rem', fontWeight: 'bold' }}>Cancel</button>
                                <button type="submit" style={{ padding: '12px 25px', backgroundColor: '#4ade80', color: '#111', fontWeight: 'bold', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '1.05rem', boxShadow: '0 4px 15px rgba(74, 222, 128, 0.3)' }}>Unlock Mode</button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}
        </nav>
    );
};

const AppContent = () => {
    const location = useLocation();
    const { username } = useUser();

    // The universal lock!
    if (!username) {
        return <Login />;
    }

    return (
        <div className="app-container">
            <Navbar />

            {/* Using React Router location.pathname as key to force remounts entirely, driving the CSS tab sliding animation! */}
            <div className="main-layout" key={location.pathname} style={{ animation: 'slideIn 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)' }}>
                <Routes location={location}>
                    <Route path="/" element={<Chat />} />
                    <Route path="/tasks" element={<Tasks />} />
                    <Route path="/notes" element={<Notes />} />
                    <Route path="/content" element={<Content />} />
                    <Route path="/teacher-admin" element={<TeacherAdmin />} />
                    <Route path="/community" element={<Community />} />
                    <Route path="/studytube" element={<StudyTube />} />
                    <Route path="/quizzes" element={<Quizzes />} />
                    <Route path="/MyResources" element={<MyResources />} />
                </Routes>
            </div>
        </div>
    );
};

export default function App() {
    return (
        <UserProvider>
            <AppContent />
        </UserProvider>
    );
}
