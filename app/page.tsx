'use client';

import { useState } from "react";
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

  return (
    <div className={`flex min-h-screen items-center justify-center font-sans transition-colors duration-500 ${config.isDarkMode ? 'bg-neutral-950' : 'bg-zinc-50'}`}>
      <SpiderControls config={config} onChange={setConfig} />
      <SpiderWeb config={config} />
    </div>
  );
}
