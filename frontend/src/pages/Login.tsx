import React from 'react';
import { useUser } from '../context/UserContext';
import { useNavigate } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';

const MOCK_USERS = [
    { id: 'u_faculty', name: 'AIE Faculty', role: 'Teacher', classLevel: 'AIE' },
    { id: 'u_cr', name: 'AIE Class Representative (CR)', role: 'Class Leader', classLevel: 'AIE' },
    { id: 'u_student', name: 'AIE Normal Student', role: 'Student', classLevel: 'AIE' }
];

export default function Login() {
    const { login } = useUser();
    const navigate = useNavigate();

    const handleLogin = (user: any) => {
        login(user.name, user.role, user.classLevel);
        navigate('/');
    };

    return (
        <div style={{ padding: '40px 20px', maxWidth: '800px', margin: '0 auto', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', marginBottom: '40px', animation: 'fadeIn 0.5s ease-out' }}>
                <h1 style={{ fontSize: '3rem', margin: '0 0 10px 0', color: 'white', fontFamily: 'Outfit, sans-serif' }}>
                    PrimeArc Login
                </h1>
                <p style={{ color: '#aaa', fontSize: '1.1rem' }}>Select your multi-user demo profile to enter the portal.</p>
            </div>

            <div style={{ width: '100%', backgroundColor: '#1a1a25', borderRadius: '20px', padding: '30px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)', border: '1px solid #333' }}>
                
                {/* Teacher Section */}
                <h2 style={{ fontSize: '1.4rem', color: '#fff', marginBottom: '15px', borderBottom: '1px solid #333', paddingBottom: '10px' }}>Faculty / Admin Access</h2>
                <div style={{ marginBottom: '30px' }}>
                    {MOCK_USERS.filter(u => u.role === 'Class Leader').map(teacher => (
                        <div 
                            key={teacher.id} onClick={() => handleLogin(teacher)}
                            style={{ padding: '15px 20px', backgroundColor: '#111', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '15px', border: '1px solid #333', transition: 'all 0.2s' }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = '#fff'; e.currentTarget.style.backgroundColor = '#222'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.backgroundColor = '#111'; }}
                        >
                            <div style={{ display: 'inline-flex', alignItems: 'center' }}><GraduationCap size={24} /></div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'white' }}>{teacher.name}</h3>
                                <p style={{ margin: '4px 0 0 0', color: '#ccc', fontSize: '0.85rem', fontWeight: 'bold' }}>All-Access Granted</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Students Section */}
                <h2 style={{ fontSize: '1.4rem', color: '#fff', marginBottom: '15px', borderBottom: '1px solid #333', paddingBottom: '10px' }}>Student / CR Accounts</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '15px', maxHeight: '400px', overflowY: 'auto', paddingRight: '10px' }}>
                    {MOCK_USERS.filter(u => u.role === 'Class Leader' || u.role === 'Student').map(student => (
                        <div 
                            key={student.id} onClick={() => handleLogin(student)}
                            style={{ padding: '12px 15px', backgroundColor: '#111', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid #333', transition: 'all 0.2s' }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = '#fff'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.transform = 'translateY(0)'; }}
                        >
                            <div style={{ width: '35px', height: '35px', borderRadius: '50%', backgroundColor: '#333', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.9rem' }}>
                                {student.role === 'Student' ? 'ST' : 'CR'}
                            </div>
                            <div>
                                <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#e0e0e0' }}>{student.name}</h4>
                                <span style={{ color: '#888', fontSize: '0.8rem' }}>{student.classLevel} Student</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            
            <div style={{ marginTop: '30px', color: '#666', fontSize: '0.9rem' }}>
                PrimeArc Multi-User Demo Environment © 2026
            </div>
        </div>
    );
}
