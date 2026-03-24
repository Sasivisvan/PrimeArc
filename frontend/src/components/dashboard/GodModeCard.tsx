// import React from 'react';
import { AlertTriangle, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

export default function GodModeCard({ title, deadline, description }: { title: string, deadline: string, description: string }) {
    return (
        <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative overflow-hidden rounded-xl border-2 border-white/20 bg-gradient-to-br from-white/5 to-transparent p-6 shadow-sm"
        >
            <div className="absolute top-0 right-0 p-2">
                <motion.span
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-xs font-bold text-black shadow-lg"
                >
                    <AlertTriangle size={12} />
                    URGENT
                </motion.span>
            </div>

            <div className="flex items-start gap-4">
                <div className="p-3 bg-white/10 rounded-full text-white">
                    <AlertTriangle size={24} />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-white">{title}</h3>
                    <p className="text-sm text-gray-400 font-medium flex items-center gap-1 mt-1">
                        <Clock size={14} /> Due: {deadline}
                    </p>
                    <p className="mt-2 text-gray-300">{description}</p>
                </div>
            </div>

            {/* Decorative pulse background */}
            <div className="absolute -z-10 -bottom-10 -right-10 w-32 h-32 bg-white/5 blur-3xl rounded-full pointer-events-none" />
        </motion.div>
    );
}
