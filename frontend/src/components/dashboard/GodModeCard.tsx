// import React from 'react';
import { AlertTriangle, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

export default function GodModeCard({ title, deadline, description }: { title: string, deadline: string, description: string }) {
    return (
        <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative overflow-hidden rounded-xl border-2 border-alert-urgent/50 bg-gradient-to-br from-alert-urgent/10 to-transparent p-6 shadow-glow-urgent"
        >
            <div className="absolute top-0 right-0 p-2">
                <motion.span
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="inline-flex items-center gap-1 rounded-full bg-alert-urgent px-2 py-1 text-xs font-bold text-white shadow-lg"
                >
                    <AlertTriangle size={12} />
                    URGENT
                </motion.span>
            </div>

            <div className="flex items-start gap-4">
                <div className="p-3 bg-alert-urgent/20 rounded-full text-alert-urgent">
                    <AlertTriangle size={24} />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-white">{title}</h3>
                    <p className="text-sm text-alert-urgent/80 font-medium flex items-center gap-1 mt-1">
                        <Clock size={14} /> Due: {deadline}
                    </p>
                    <p className="mt-2 text-gray-300">{description}</p>
                </div>
            </div>

            {/* Decorative pulse background */}
            <div className="absolute -z-10 -bottom-10 -right-10 w-32 h-32 bg-alert-urgent/20 blur-3xl rounded-full pointer-events-none" />
        </motion.div>
    );
}
