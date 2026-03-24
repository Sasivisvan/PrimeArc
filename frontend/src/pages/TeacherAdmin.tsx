import React, { useState } from 'react';

export default function TeacherAdmin() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (password === 'teacherauth') {
            setIsAuthenticated(true);
        } else {
            alert("Incorrect teacher password.");
        }
    };

    if (!isAuthenticated) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: 'white' }}>
                <form onSubmit={handleLogin} style={{ backgroundColor: '#2a2a35', padding: '40px', borderRadius: '15px', display: 'flex', flexDirection: 'column', gap: '20px', width: '350px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                    <div style={{ textAlign: 'center', fontSize: '3rem', marginBottom: '10px' }}>🔐</div>
                    <h2 style={{ margin: 0, textAlign: 'center' }}>Teacher Access</h2>
                    <p style={{ color: '#888', textAlign: 'center', margin: '0 0 20px 0', fontSize: '0.9rem' }}>Enter the master teacher password to view class credentials.</p>
                    <input 
                        type="password" required placeholder="Password (Hint: teacherauth)" 
                        value={password} onChange={e => setPassword(e.target.value)}
                        style={{ padding: '15px', borderRadius: '8px', border: '1px solid #444', backgroundColor: '#1a1a25', color: 'white' }}
                    />
                    <button type="submit" style={{ padding: '15px', backgroundColor: '#fff', color: '#000', fontWeight: 'bold', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                        Authenticate
                    </button>
                </form>
            </div>
        );
    }

    return (
        <div style={{ padding: '40px 20px', color: 'white', maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '40px' }}>
                <div style={{ fontSize: '3rem' }}>🛡️</div>
                <div>
                    <h1 style={{ fontSize: '2.5rem', margin: 0, color: '#fff' }}>Teacher Admin Portal</h1>
                    <p style={{ color: '#aaa', margin: '5px 0 0 0', fontSize: '1.1rem' }}>Secure credentials index. Do not share this page directly with students.</p>
                </div>
            </div>

            <div style={{ backgroundColor: '#1a1a25', border: '1px solid #333', borderRadius: '15px', overflow: 'hidden' }}>
                <div style={{ padding: '20px 30px', backgroundColor: '#2a2a35', borderBottom: '1px solid #444' }}>
                    <h2 style={{ margin: 0, fontSize: '1.4rem' }}>Class Leader Passwords</h2>
                </div>
                
                <div style={{ padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', backgroundColor: '#111', borderRadius: '10px', borderLeft: '4px solid #fff' }}>
                        <div>
                            <h3 style={{ margin: '0 0 5px 0', fontSize: '1.2rem' }}>Global Demo Password</h3>
                            <p style={{ margin: 0, color: '#888' }}>Applies to all classes currently in V4 Demo mode.</p>
                        </div>
                        <div style={{ backgroundColor: '#000', padding: '10px 20px', borderRadius: '8px', border: '1px solid #333', color: '#fff', fontFamily: 'monospace', fontSize: '1.2rem', letterSpacing: '2px' }}>
                            primearc2026
                        </div>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', backgroundColor: '#22222d', borderRadius: '10px', opacity: 0.6 }}>
                        <div>
                            <h3 style={{ margin: '0 0 5px 0', fontSize: '1.2rem' }}>Production Class Keys</h3>
                            <p style={{ margin: 0, color: '#888' }}>Not yet active. System currently using Global Demo Password.</p>
                        </div>
                        <button disabled style={{ padding: '10px 20px', backgroundColor: '#333', color: '#666', border: 'none', borderRadius: '8px', cursor: 'not-allowed' }}>Generate</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
