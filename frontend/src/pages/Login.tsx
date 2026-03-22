import React from 'react';
import { useUser } from '../context/UserContext';
import { useNavigate } from 'react-router-dom';

const MOCK_USERS = [
    { id: 'u_teacher', name: 'Professor Sharma (Head Teacher)', role: 'Class Leader', classLevel: 10 },
    ...Array.from({ length: 24 }).map((_, i) => {
        const classLvl = Math.floor(i / 2) + 1;
        const studentNum = (i % 2) + 1;
        return {
            id: `u_student_${classLvl}_${studentNum}`,
            name: `Mock Student ${studentNum} (Class ${classLvl})`,
            role: 'Student',
            classLevel: classLvl
        };
    })
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
                <h1 style={{ fontSize: '3rem', margin: '0 0 10px 0', background: 'linear-gradient(90deg, #b14fff, #00e5ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontFamily: 'Outfit, sans-serif' }}>
                    PrimeArc Login
                </h1>
                <p style={{ color: '#aaa', fontSize: '1.1rem' }}>Select your multi-user demo profile to enter the portal.</p>
            </div>

            <div style={{ width: '100%', backgroundColor: '#1a1a25', borderRadius: '20px', padding: '30px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)', border: '1px solid #333' }}>
                
                {/* Teacher Section */}
                <h2 style={{ fontSize: '1.4rem', color: '#4ade80', marginBottom: '15px', borderBottom: '1px solid #333', paddingBottom: '10px' }}>Faculty / Admin Access</h2>
                <div style={{ marginBottom: '30px' }}>
                    {MOCK_USERS.filter(u => u.role === 'Class Leader').map(teacher => (
                        <div 
                            key={teacher.id} onClick={() => handleLogin(teacher)}
                            style={{ padding: '15px 20px', backgroundColor: '#2a2a35', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '15px', border: '1px solid #444', transition: 'all 0.2s' }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = '#4ade80'; e.currentTarget.style.backgroundColor = 'rgba(74, 222, 128, 0.1)'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = '#444'; e.currentTarget.style.backgroundColor = '#2a2a35'; }}
                        >
                            <div style={{ fontSize: '1.8rem' }}>👨‍🏫</div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'white' }}>{teacher.name}</h3>
                                <p style={{ margin: '4px 0 0 0', color: '#4ade80', fontSize: '0.85rem', fontWeight: 'bold' }}>All-Access Granted</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Students Section */}
                <h2 style={{ fontSize: '1.4rem', color: '#00e5ff', marginBottom: '15px', borderBottom: '1px solid #333', paddingBottom: '10px' }}>Student Accounts</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '15px', maxHeight: '400px', overflowY: 'auto', paddingRight: '10px' }}>
                    {MOCK_USERS.filter(u => u.role === 'Student').map(student => (
                        <div 
                            key={student.id} onClick={() => handleLogin(student)}
                            style={{ padding: '12px 15px', backgroundColor: '#2a2a35', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid #333', transition: 'all 0.2s' }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = '#00e5ff'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.transform = 'translateY(0)'; }}
                        >
                            <div style={{ width: '35px', height: '35px', borderRadius: '50%', backgroundColor: 'rgba(0,229,255,0.15)', color: '#00e5ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                                S{student.classLevel}
                            </div>
                            <div>
                                <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#e0e0e0' }}>{student.name}</h4>
                                <span style={{ color: '#888', fontSize: '0.8rem' }}>Class {student.classLevel} Student</span>
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
