import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

type Role = 'Student' | 'Class Leader' | 'Teacher';

interface UserContextType {
    classLevel: string | number;
    setClassLevel: (c: string | number) => void;
    role: Role | null;
    setRole: (r: Role | null) => void;
    username: string | null;
    setUsername: (n: string | null) => void;
    login: (name: string, r: Role, cLvl: string | number) => void;
    logout: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: ReactNode }) => {
    // Null defaults. If null, the App will render the Login portal.
    const [classLevel, setClassLevel] = useState<string | number>('AIE');
    const [role, setRole] = useState<Role | null>(null);
    const [username, setUsername] = useState<string | null>(null);

    const login = (name: string, r: Role, cLvl: string | number) => {
        setUsername(name);
        setRole(r);
        setClassLevel(cLvl);
    };

    const logout = () => {
        setUsername(null);
        setRole(null);
    };

    return (
        <UserContext.Provider value={{ classLevel, setClassLevel, role, setRole, username, setUsername, login, logout }}>
            {children}
        </UserContext.Provider>
    );
};

export const useUser = () => {
    const context = useContext(UserContext);
    if (!context) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
};
