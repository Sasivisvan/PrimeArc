import React, { useState, useRef, useEffect } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Home, Library, Brain, MessageSquare, User, Sparkles } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import AISidePanel from '../brain/AISidePanel';
import { AnimatePresence, motion } from 'framer-motion';

function cn(...inputs: (string | undefined | null | false)[]) {
    return twMerge(clsx(inputs));
}

const NavItem = ({ to, icon: Icon, label, className }: { to: string; icon: React.ElementType; label: string; className?: string }) => {
    return (
        <NavLink
            to={to}
            className={({ isActive }) => cn(
                "flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-200 group text-sm",
                isActive
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-gray-400 hover:text-white hover:bg-white/5",
                className
            )}
        >
            <Icon size={18} className="group-hover:scale-110 transition-transform duration-200" />
            <span className="font-medium">{label}</span>
        </NavLink>
    );
};

export default function AppLayout() {
    const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
    const [panelWidth, setPanelWidth] = useState(400);
    const [isResizing, setIsResizing] = useState(false);

    const startResizing = React.useCallback((mouseDownEvent: React.MouseEvent) => {
        setIsResizing(true);
    }, []);

    const stopResizing = React.useCallback(() => {
        setIsResizing(false);
    }, []);

    const resize = React.useCallback((mouseMoveEvent: MouseEvent) => {
        if (isResizing) {
            const newWidth = window.innerWidth - mouseMoveEvent.clientX;
            // Clamp width between 300px and 800px (or window.innerWidth - 100)
            const clampedWidth = Math.max(300, Math.min(newWidth, Math.min(800, window.innerWidth - 300)));
            setPanelWidth(clampedWidth);
        }
    }, [isResizing]);

    useEffect(() => {
        window.addEventListener("mousemove", resize);
        window.addEventListener("mouseup", stopResizing);
        return () => {
            window.removeEventListener("mousemove", resize);
            window.removeEventListener("mouseup", stopResizing);
        };
    }, [resize, stopResizing]);

    return (
        <div className={`flex h-screen flex-col bg-background overflow-hidden ${isResizing ? 'cursor-col-resize select-none' : ''}`}>
            {/* Top Navbar (Desktop) */}
            <header className="hidden md:flex h-16 items-center justify-between border-b border-white/5 bg-surface/30 backdrop-blur-xl px-6 shrink-0 z-30">
                {/* Logo */}
                <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-secondary" />
                    <span className="text-xl font-bold tracking-wider text-white">PRIME<span className="text-primary">ARC</span></span>
                </div>

                {/* Nav Links */}
                <nav className="flex items-center gap-1 bg-white/5 p-1 rounded-full border border-white/5">
                    <NavItem to="/" icon={Home} label="Board" />
                    <NavItem to="/library" icon={Library} label="Library" />
                    <NavItem to="/forums" icon={MessageSquare} label="Forums" />
                </nav>

                {/* Profile */}
                <div className="flex items-center gap-3 pl-4 border-l border-white/10">
                    <div className="text-right hidden lg:block">
                        <div className="text-sm font-medium text-white">Student Name</div>
                        <div className="text-xs text-primary">Class Representative</div>
                    </div>
                    <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center text-white font-bold ring-2 ring-white/10">
                        S
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <div className="flex flex-1 overflow-hidden relative">

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto relative">
                    <div className="max-w-7xl mx-auto p-4 md:p-8 pb-24 md:pb-8">
                        <Outlet />
                    </div>

                    {/* Desktop Floating AI Toggle (Only visible if closed) */}
                    <AnimatePresence>
                        {!isAIPanelOpen && (
                            <motion.button
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0, opacity: 0 }}
                                onClick={() => setIsAIPanelOpen(true)}
                                className="hidden md:flex fixed right-8 bottom-8 z-40 rounded-full bg-primary p-4 shadow-[0_0_20px_rgba(0,229,255,0.4)] hover:shadow-[0_0_30px_rgba(0,229,255,0.6)] hover:scale-110 active:scale-95 transition-all text-black group"
                            >
                                <Brain size={24} className="group-hover:rotate-12 transition-transform" />
                            </motion.button>
                        )}
                    </AnimatePresence>
                </main>

                {/* AI Panel (Side-by-Side Layout) */}
                <AnimatePresence mode="popLayout">
                    {isAIPanelOpen && (
                        <motion.div
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: panelWidth, opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }}
                            transition={{ type: "spring", stiffness: 300, damping: 30, duration: 0.1 }}
                            style={{ width: panelWidth }}
                            className="hidden md:flex h-full border-l border-white/10 bg-[#0B1120] relative z-20 shadow-xl"
                        >
                            {/* Resize Handle */}
                            <div
                                onMouseDown={startResizing}
                                className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 transition-colors z-50 bg-transparent hover:w-1.5 active:bg-primary"
                            />

                            <div style={{ width: panelWidth }} className="h-full w-full overflow-hidden">
                                <AISidePanel onClose={() => setIsAIPanelOpen(false)} />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

            </div>

            {/* Bottom Bar (Mobile) - Unchanged */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-xl border-t border-white/10 p-2 flex justify-around items-center z-50 pb-safe">
                <NavLink to="/" className={({ isActive }) => cn("p-3 rounded-full", isActive ? "text-primary" : "text-gray-400")}>
                    <Home size={24} />
                </NavLink>
                <NavLink to="/library" className={({ isActive }) => cn("p-3 rounded-full", isActive ? "text-primary" : "text-gray-400")}>
                    <Library size={24} />
                </NavLink>
                <div className="relative -top-5">
                    <button
                        onClick={() => setIsAIPanelOpen(!isAIPanelOpen)}
                        className={cn(
                            "flex items-center justify-center p-4 rounded-full bg-gradient-to-br from-primary to-secondary shadow-[0_0_20px_rgba(0,229,255,0.4)] text-white",
                            isAIPanelOpen && "ring-2 ring-white/20"
                        )}
                    >
                        <Brain size={28} />
                    </button>
                </div>
                <NavLink to="/forums" className={({ isActive }) => cn("p-3 rounded-full", isActive ? "text-primary" : "text-gray-400")}>
                    <MessageSquare size={24} />
                </NavLink>
                <NavLink to="/profile" className={({ isActive }) => cn("p-3 rounded-full", isActive ? "text-primary" : "text-gray-400")}>
                    <User size={24} />
                </NavLink>
            </nav>

            {/* Mobile AI Modal (Separate from desktop flex layout) */}
            <AnimatePresence>
                {isAIPanelOpen && (
                    <motion.div
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        className="md:hidden fixed inset-0 z-[60] bg-background"
                    >
                        <AISidePanel onClose={() => setIsAIPanelOpen(false)} />
                    </motion.div>
                )}
            </AnimatePresence>

        </div>
    );
}
