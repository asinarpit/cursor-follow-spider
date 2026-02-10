'use client';

import { useState } from "react";
import { motion } from "framer-motion";
import { Heart, Github, Code, Star, ExternalLink } from "lucide-react";
import SpiderWeb from "@/components/SpiderWeb";
import SpiderControls, { SpiderConfig } from "@/components/SpiderControls";

const DEFAULT_CONFIG: SpiderConfig = {
  gridSpacing: 40,
  legReach: 120,
  stepSpeed: 0.25,
  maxSpeed: 8.0,
  stepLiftHeight: 18,
  bodyRadius: 10,
  dotInteractionRange: 60,
  isDarkMode: true,
  showGrid: true,
};

export default function Home() {
  const [config, setConfig] = useState<SpiderConfig>(DEFAULT_CONFIG);

  const githubUrl = "https://github.com/asinarpit/cursor-follow-spider";

  return (
    <div className={`relative flex min-h-screen items-center justify-center font-sans transition-colors duration-1000 overflow-hidden ${config.isDarkMode ? 'bg-neutral-950' : 'bg-zinc-50'}`}>

      {/* Top Header UI */}
      <div className="fixed top-6 right-6 z-50 flex flex-col items-end gap-3 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 p-2 pl-4 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl pointer-events-auto"
        >
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Love this?</span>
            <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">Add a star on GitHub</span>
          </div>
          <a
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl font-bold text-sm hover:scale-105 transition-transform active:scale-95"
          >
            <Github size={16} />
            Use it in your project
          </a>
        </motion.div>
      </div>

      <SpiderControls config={config} onChange={setConfig} />
      <SpiderWeb config={config} />

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
      >
        <div className="px-6 py-3 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm border border-zinc-200/50 dark:border-zinc-800/50 rounded-full shadow-lg flex items-center gap-2 pointer-events-auto hover:bg-white/80 dark:hover:bg-zinc-900/80 transition-all group">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Made with</span>
          <Heart size={14} className="text-red-500 fill-red-500 group-hover:scale-125 transition-transform" />
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">by</span>
          <a
            href="https://github.com/asinarpit"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-bold text-zinc-900 dark:text-zinc-100 hover:underline decoration-zinc-400 underline-offset-4"
          >
            Arpit Singh
          </a>
        </div>
      </motion.div>

    </div>
  );
}
