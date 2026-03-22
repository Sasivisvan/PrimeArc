import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';

// 1. Import your Auth pages
import LoginPage from './pages/login';
import SigninPage from './pages/signin';

// Placeholders for now
const Library = () => <div className="text-2xl font-bold text-white">The Library (Coming Soon)</div>;
const Forums = () => <div className="text-2xl font-bold text-white">Forums (Coming Soon)</div>;
const Profile = () => <div className="text-2xl font-bold text-white">Profile (Coming Soon)</div>;

function App() {
    return (
        <Router>
            <Routes>
                {/* --- PUBLIC ROUTES --- */}
                {/* These are NOT wrapped in AppLayout, so they will take up the full screen */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signin" element={<SigninPage />} />


                {/* --- PROTECTED APP ROUTES --- */}
                {/* These ARE wrapped in AppLayout, so they get the Sidebar/Header */}
                <Route element={<AppLayout />}>
                    {/* I changed path="/" to "/dashboard" so the root URL can redirect to login */}
                    <Route path="/dashboard" element={<Dashboard />} /> 
                    <Route path="/library" element={<Library />} />
                    <Route path="/forums" element={<Forums />} />
                    <Route path="/profile" element={<Profile />} />
                </Route>


                {/* --- REDIRECTS --- */}
                {/* By default, redirect "/" to "/login" */}
                <Route path="/" element={<Navigate to="/login" replace />} />
                
                {/* Catch-all: redirect unknown paths to login */}
                <Route path="*" element={<Navigate to="/login" replace />} />
                
            </Routes>
        </Router>
    );
}

export default App;