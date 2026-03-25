import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import "./App.css";

// V.3.0 imports
import Chat from "./pages/Chat";
import Tasks from "./pages/Tasks";
import Notes from "./pages/Notes";
import MyResources from "./pages/MyResources";
import Content from "./pages/Content";
import Community from "./pages/Community";
import StudyTube from "./pages/StudyTube";
import Quizzes from "./pages/Quizzes";
import Flashcards from "./pages/Flashcards";
import TeacherAdmin from "./pages/TeacherAdmin";
import Programming from "./pages/Programming";
import LoginV3 from "./pages/Login";
import { UserProvider, useUser } from "./context/UserContext";

// Main branch imports
import AppLayout from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';
import LoginPage from './pages/main-login';
import SigninPage from './pages/signin';

// Placeholders for main branch
const Library = () => <div className="text-2xl font-bold text-white">The Library (Coming Soon)</div>;
const Forums = () => <div className="text-2xl font-bold text-white">Forums (Coming Soon)</div>;
const Profile = () => <div className="text-2xl font-bold text-white">Profile (Coming Soon)</div>;

const Navbar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const currentPath = location.pathname;
    const { classLevel } = useUser();

    return (
        <nav className="top-nav-bar">
            <div className="top-nav-inner">
                <div className="top-nav-left">
                    <div className="brand-title" onClick={() => navigate("/")} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', margin: 0 }}>
                        PrimeArc
                    </div>
                    <div className="nav-links">
                    <button className={`nav-btn ${currentPath === '/' ? 'active' : ''}`} onClick={() => navigate("/")}>Chat</button>
                    <button className={`nav-btn ${currentPath === '/content' ? 'active' : ''}`} onClick={() => navigate("/content")}>Content</button>
                    <button className={`nav-btn ${currentPath === '/tasks' ? 'active' : ''}`} onClick={() => navigate("/tasks")}>Tasks</button>
                    <button className={`nav-btn ${currentPath === '/notes' ? 'active' : ''}`} onClick={() => navigate("/notes")}>Notes</button>
                    <button className={`nav-btn ${currentPath === '/quizzes' ? 'active' : ''}`} onClick={() => navigate("/quizzes")}>Quiz</button>
                    <button className={`nav-btn ${currentPath === '/flashcards' ? 'active' : ''}`} onClick={() => navigate("/flashcards")}>Flashcards</button>
                    <button className={`nav-btn ${currentPath === '/studytube' ? 'active' : ''}`} onClick={() => navigate("/studytube")}>StudyTube</button>
                    <button className={`nav-btn ${currentPath === '/MyResources' ? 'active' : ''}`} onClick={() => navigate("/MyResources")}>Resources</button>
                    <button className={`nav-btn ${currentPath === '/programming' ? 'active' : ''}`} onClick={() => navigate("/programming")}>Programming</button>
                    </div>
                </div>
            
                <div className="profile-selector">
                    <div className="profile-selector-pill">
                        <span>{classLevel}</span>
                    </div>
                </div>
            </div>
        </nav>
    );
};

const AppContent = () => {
    const location = useLocation();
    const { username } = useUser();

    const isAuthRoute = location.pathname.startsWith('/login') || location.pathname.startsWith('/signin');

    // The universal lock from V.3.0
    if (!username && !isAuthRoute) {
        return <LoginV3 />;
    }

    return (
        <div className="app-container">
            {!isAuthRoute && <Navbar />}

            <div className="main-layout" key={location.pathname} style={{ animation: 'slideIn 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)' }}>
                <Routes location={location}>
                    {/* V.3.0 Routes */}
                    <Route path="/" element={<Chat />} />
                    <Route path="/tasks" element={<Tasks />} />
                    <Route path="/notes" element={<Notes />} />
                    <Route path="/content" element={<Content />} />
                    <Route path="/teacher-admin" element={<TeacherAdmin />} />
                    <Route path="/community" element={<Community />} />
                    <Route path="/studytube" element={<StudyTube />} />
                    <Route path="/quizzes" element={<Quizzes />} />
                    <Route path="/flashcards" element={<Flashcards />} />
                    <Route path="/MyResources" element={<MyResources />} />
                    <Route path="/programming" element={<Programming />} />

                    {/* Main Branch Public Routes */}
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/signin" element={<SigninPage />} />

                    {/* Main Branch Protected Routes */}
                    <Route element={<AppLayout />}>
                        <Route path="/dashboard" element={<Dashboard />} /> 
                        <Route path="/library" element={<Library />} />
                        <Route path="/forums" element={<Forums />} />
                        <Route path="/profile" element={<Profile />} />
                    </Route>
                </Routes>
            </div>
        </div>
    );
};

export default function App() {
    return (
        <UserProvider>
            <Router>
                <AppContent />
            </Router>
        </UserProvider>
    );
}
