'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Settings2,
    X,
    Grid3X3,
    Maximize,
    Move,
    Zap,
    ArrowUpFromLine,
    Target,
    Moon,
    Sun,
    Circle
} from 'lucide-react';

export interface SpiderConfig {
    gridSpacing: number;
    legReach: number;
    stepSpeed: number;
    maxSpeed: number;
    stepLiftHeight: number;
    bodyRadius: number;
    dotInteractionRange: number;
    isDarkMode: boolean;
    showGrid: boolean;
}

interface SpiderControlsProps {
    config: SpiderConfig;
    onChange: (config: SpiderConfig) => void;
}

const ControlSlider = ({
    label,
    value,
    min,
    max,
    step = 1,
    icon: Icon,
    onChange
}: {
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    icon: React.ElementType;
    onChange: (val: number) => void
}) => {
    return (
        <div className="flex flex-col gap-2 mb-4">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <Icon size={14} className="text-zinc-400 dark:text-zinc-500" />
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                        {label}
                    </label>
                </div>
                <span className="text-[10px] font-mono bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-600 dark:text-zinc-300">
                    {value.toFixed(step < 1 ? 2 : 0)}
                </span>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                className="w-full h-1 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-500 dark:accent-zinc-400"
            />
        </div>
    );
};

export default function SpiderControls({ config, onChange }: SpiderControlsProps) {
    const [isOpen, setIsOpen] = React.useState(true);

    const updateConfig = (key: keyof SpiderConfig, value: any) => {
        onChange({ ...config, [key]: value });
    };

    return (
        <div className="fixed top-6 left-6 z-50 pointer-events-none">
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="pointer-events-auto"
            >
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="group mb-4 flex items-center gap-3 px-5 py-2.5 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl hover:bg-white dark:hover:bg-zinc-900 transition-all active:scale-95"
                >
                    <motion.div
                        animate={{ rotate: isOpen ? 180 : 0 }}
                        className="text-zinc-500 dark:text-zinc-400"
                    >
                        {isOpen ? <X size={18} /> : <Settings2 size={18} />}
                    </motion.div>
                    <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200 tracking-tight">
                        {isOpen ? 'Close Settings' : 'Spider Settings'}
                    </span>
                </button>

                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: -20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: -20 }}
                            className="w-80 p-6 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-2xl border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] overflow-hidden"
                        >
                            <div className="mb-6 flex justify-between items-start">
                                <div>
                                    <h3 className="text-xl font-black text-zinc-900 dark:text-white tracking-tighter">Controller</h3>
                                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase font-black tracking-widest mt-1">Environmental Parameters</p>
                                </div>
                                <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
                                    <Settings2 size={16} className="text-zinc-400" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <ControlSlider
                                    label="Grid Spacing"
                                    value={config.gridSpacing}
                                    min={20}
                                    max={100}
                                    icon={Grid3X3}
                                    onChange={(v) => updateConfig('gridSpacing', v)}
                                />
                                <ControlSlider
                                    label="Leg Reach"
                                    value={config.legReach}
                                    min={50}
                                    max={250}
                                    icon={Maximize}
                                    onChange={(v) => updateConfig('legReach', v)}
                                />
                                <ControlSlider
                                    label="Body Radius"
                                    value={config.bodyRadius}
                                    min={5}
                                    max={30}
                                    icon={Circle}
                                    onChange={(v) => updateConfig('bodyRadius', v)}
                                />
                                <ControlSlider
                                    label="Step Speed"
                                    value={config.stepSpeed}
                                    min={0.05}
                                    max={1.0}
                                    step={0.01}
                                    icon={Zap}
                                    onChange={(v) => updateConfig('stepSpeed', v)}
                                />
                                <ControlSlider
                                    label="Max Speed"
                                    value={config.maxSpeed}
                                    min={1.0}
                                    max={20.0}
                                    step={0.5}
                                    icon={Move}
                                    onChange={(v) => updateConfig('maxSpeed', v)}
                                />
                                <ControlSlider
                                    label="Step Height"
                                    value={config.stepLiftHeight}
                                    min={5}
                                    max={50}
                                    icon={ArrowUpFromLine}
                                    onChange={(v) => updateConfig('stepLiftHeight', v)}
                                />
                                <ControlSlider
                                    label="Mag Range"
                                    value={config.dotInteractionRange}
                                    min={20}
                                    max={150}
                                    icon={Target}
                                    onChange={(v) => updateConfig('dotInteractionRange', v)}
                                />
                            </div>

                            <div className="mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-3">
                                <button
                                    onClick={() => updateConfig('isDarkMode', !config.isDarkMode)}
                                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors shadow-sm"
                                >
                                    {config.isDarkMode ? <Sun size={14} className="text-amber-500" /> : <Moon size={14} className="text-zinc-600" />}
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                                        {config.isDarkMode ? 'Light' : 'Dark'}
                                    </span>
                                </button>

                                <button
                                    onClick={() => updateConfig('showGrid', !config.showGrid)}
                                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl transition-all shadow-sm ${config.showGrid
                                            ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500'
                                        }`}
                                >
                                    <Grid3X3 size={14} />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">
                                        Grid
                                    </span>
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
}
