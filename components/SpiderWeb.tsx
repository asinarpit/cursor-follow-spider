'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, useSpring, useMotionValue } from 'framer-motion';

// ── Configuration (Defaults) ───────────────────────────────────
const LEG_COUNT = 8;
// const HEAD_RADIUS = 6;
// const ABDOMEN_RX = 14;
// const ABDOMEN_RY = 11;
const EYE_RADIUS = 1.8;
const THEME_ACCENT_RED = '#ff1e1e';
const THEME_ACCENT_RED_LIGHT = '#cc2222';

// ── Precomputed (Static) ───────────────────────────────────────
const TWO_PI = Math.PI * 2;
const HALF_PI_OVER_2_5 = Math.PI / 2.5;

import { SpiderConfig } from './SpiderControls';

// ── Theme configuration ────────────────────────────────────────
const THEME = {
    dark: {
        dotShadow: 'rgba(20, 20, 20, 0.4)',
        dotHighlight: 'rgba(50, 50, 50, 0.2)',
        dotCore: 'rgba(60, 60, 60, 0.3)',
        neuLight: '#2a2a2a',
        neuShadow: '#121212',
        spiderBase: '#1a1a1a',
        spiderGloss: '#222222',
        spiderSheen: '#333333',
        spiderAccent: '#555555',
        spiderAccentBright: '#777777',
        spiderLeg: '#1c1c1c',
        spiderLegHighlight: '#2a2a2a',
        jointShadow: 'rgba(0,0,0,0.3)',
        bodyShadow: 'rgba(0,0,0,0.25)',
        magneticArc: 'rgba(160,160,160,',
        pulledDotCore: 'rgba(180,180,180,',
        grabbedDotCore: 'rgba(160,160,160,0.3)',
        activeDot: '#777777', // BW_RED_BRIGHT
        eyeGlow: 'rgba(160,160,160,0.25)',
    },
    light: {
        dotShadow: 'rgba(0, 0, 0, 0.06)',
        dotHighlight: 'rgba(255, 255, 255, 0.9)',
        dotCore: 'rgba(0, 0, 0, 0.1)',
        neuLight: '#f0f0f0',
        neuShadow: '#d1d9e6',
        spiderBase: '#3d3d3d', // Less dark charcoal
        spiderGloss: '#505050',
        spiderSheen: '#707070',
        spiderAccent: '#606060',
        spiderAccentBright: '#888888',
        spiderLeg: '#454545',
        spiderLegHighlight: '#6d6d6d',
        jointShadow: 'rgba(0,0,0,0.08)',
        bodyShadow: 'rgba(0,0,0,0.1)',
        magneticArc: 'rgba(100,100,100,',
        pulledDotCore: 'rgba(140,140,140,',
        grabbedDotCore: 'rgba(180,180,180,0.2)',
        activeDot: '#666666',
        eyeGlow: 'rgba(120,120,120,0.15)',
    }
};

// Leg angle offsets RELATIVE to heading (radians)
const LEG_ANGLE_OFFSETS = [
    Math.PI * 0.35, Math.PI * 0.58, Math.PI * 0.76, Math.PI * 0.92,
    -Math.PI * 0.35, -Math.PI * 0.58, -Math.PI * 0.76, -Math.PI * 0.92,
];

interface Point { x: number; y: number; }

interface LegState {
    target: Point | null;
    current: Point;
    previous: Point;
    stepping: boolean;
    stepProgress: number;
    planted: boolean;
}

// ── Inlined helpers (avoid sqrt when possible) ─────────────────
function distSq(ax: number, ay: number, bx: number, by: number) {
    const dx = ax - bx;
    const dy = ay - by;
    return dx * dx + dy * dy;
}

function findBestDotForLeg(
    bx: number, by: number, preferredRad: number,
    nearbyDotsX: Float32Array, nearbyDotsY: Float32Array, dotCount: number,
    usedDots: Set<number>, reachSq: number, minSq: number
): number {
    const idealDist = Math.sqrt(reachSq) * 0.65;
    const idealX = bx + Math.cos(preferredRad) * idealDist;
    const idealY = by + Math.sin(preferredRad) * idealDist;
    let bestIdx = -1;
    let bestScore = Infinity;
    for (let j = 0; j < dotCount; j++) {
        if (usedDots.has(j)) continue;
        const dx = nearbyDotsX[j] - bx;
        const dy = nearbyDotsY[j] - by;
        const dSq = dx * dx + dy * dy;
        if (dSq > reachSq || dSq < minSq) continue;
        const angleToDot = Math.atan2(dy, dx);
        let angleDiff = Math.abs(angleToDot - preferredRad);
        if (angleDiff > Math.PI) angleDiff = TWO_PI - angleDiff;
        if (angleDiff > HALF_PI_OVER_2_5) continue;
        const ddx = nearbyDotsX[j] - idealX;
        const ddy = nearbyDotsY[j] - idealY;
        const score = Math.sqrt(ddx * ddx + ddy * ddy) + angleDiff * 30;
        if (score < bestScore) { bestScore = score; bestIdx = j; }
    }
    return bestIdx;
}

// ── Component ──────────────────────────────────────────────────
export default function SpiderWeb({ config }: { config: SpiderConfig }) {
    const {
        gridSpacing: GRID_SPACING,
        legReach: LEG_REACH,
        stepSpeed: STEP_SPEED,
        maxSpeed: MAX_SPEED,
        stepLiftHeight: STEP_LIFT_HEIGHT,
        bodyRadius: BODY_RADIUS,
        dotInteractionRange: DOT_INTERACTION_RANGE,
        isDarkMode,
        showGrid
    } = config;

    const HEAD_RADIUS = BODY_RADIUS * 0.6;
    const ABDOMEN_RX = BODY_RADIUS * 1.4;
    const ABDOMEN_RY = BODY_RADIUS * 1.1;

    const MAG_DOT_PULL_RADIUS = DOT_INTERACTION_RANGE;
    const MAG_DOT_PULL_RADIUS_SQ = MAG_DOT_PULL_RADIUS * MAG_DOT_PULL_RADIUS;
    const MAG_DOT_PULL_STRENGTH = 8;
    const MAG_ARC_RADIUS = DOT_INTERACTION_RANGE * 0.7;
    const MAG_ARC_RADIUS_SQ = MAG_ARC_RADIUS * MAG_ARC_RADIUS;

    const STEP_THRESHOLD = LEG_REACH * 1.15;
    const STEP_THRESHOLD_SQ = STEP_THRESHOLD * STEP_THRESHOLD;
    const STEP_TOO_CLOSE = BODY_RADIUS * 1.2;
    const STEP_TOO_CLOSE_SQ = STEP_TOO_CLOSE * STEP_TOO_CLOSE;

    const BODY_RADIUS_PLUS_5_SQ = (BODY_RADIUS + 5) ** 2;
    const BODY_RADIUS_PLUS_8_SQ = (BODY_RADIUS + 8) ** 2;
    const BODY_RADIUS_PLUS_2_SQ = (BODY_RADIUS + 2) ** 2;
    const LEG_REACH_SQ = LEG_REACH * LEG_REACH;

    const GAIT_GROUP_A = new Set([0, 2, 5, 7]);
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [dims, setDims] = useState({ w: 0, h: 0 });

    const bodyX = useMotionValue(0);
    const bodyY = useMotionValue(0);
    const springX = useSpring(bodyX, { stiffness: 250, damping: 25, mass: 0.8 });
    const springY = useSpring(bodyY, { stiffness: 250, damping: 25, mass: 0.8 });

    const legsRef = useRef<LegState[]>([]);
    const mouseRef = useRef<Point>({ x: 0, y: 0 });
    const animFrameRef = useRef<number>(0);
    const gaitPhaseRef = useRef<'A' | 'B'>('A');

    // Pre-allocate typed arrays for nearby dots (avoid GC)
    const nearbyXRef = useRef(new Float32Array(64));
    const nearbyYRef = useRef(new Float32Array(64));
    const usedDotsRef = useRef(new Set<number>());

    // Cache the off-screen dot pattern as an ImageBitmap
    const dotPatternRef = useRef<ImageBitmap | null>(null);
    const dotPatternDimsRef = useRef({ w: 0, h: 0 });

    // Resize
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const ro = new ResizeObserver(entries => {
            for (const entry of entries) {
                setDims({ w: entry.contentRect.width, h: entry.contentRect.height });
            }
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    // Mouse + Touch tracking
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const updatePosition = (clientX: number, clientY: number) => {
            const rect = el.getBoundingClientRect();
            mouseRef.current.x = clientX - rect.left;
            mouseRef.current.y = clientY - rect.top;
        };

        const onMouseMove = (e: MouseEvent) => {
            updatePosition(e.clientX, e.clientY);
        };

        const onTouchStart = (e: TouchEvent) => {
            e.preventDefault(); // prevent scroll while swiping over spider
            const touch = e.touches[0];
            if (touch) updatePosition(touch.clientX, touch.clientY);
        };

        const onTouchMove = (e: TouchEvent) => {
            e.preventDefault();
            const touch = e.touches[0];
            if (touch) updatePosition(touch.clientX, touch.clientY);
        };

        el.addEventListener('mousemove', onMouseMove);
        el.addEventListener('touchstart', onTouchStart, { passive: false });
        el.addEventListener('touchmove', onTouchMove, { passive: false });

        return () => {
            el.removeEventListener('mousemove', onMouseMove);
            el.removeEventListener('touchstart', onTouchStart);
            el.removeEventListener('touchmove', onTouchMove);
        };
    }, [bodyX, bodyY]);

    // ── Pre-render static dot grid to offscreen canvas ─────────
    const buildDotPattern = useCallback((w: number, h: number, isDark: boolean, spacing: number) => {
        if (dotPatternDimsRef.current.w === w && dotPatternDimsRef.current.h === h && dotPatternRef.current) return;
        const offscreen = document.createElement('canvas');
        offscreen.width = w;
        offscreen.height = h;
        const octx = offscreen.getContext('2d');
        if (!octx) return;

        const cols = Math.floor(w / spacing) + 1;
        const rows = Math.floor(h / spacing) + 1;

        // Theme-aware dot colors
        const colors = isDark ? THEME.dark : THEME.light;
        const { dotShadow, dotHighlight, dotCore } = colors;

        for (let c = 0; c < cols; c++) {
            for (let r = 0; r < rows; r++) {
                const x = c * spacing;
                const y = r * spacing;
                // shadow side
                octx.beginPath();
                octx.arc(x + 0.6, y + 0.6, 2, 0, TWO_PI);
                octx.fillStyle = dotShadow;
                octx.fill();
                // highlight side
                octx.beginPath();
                octx.arc(x - 0.3, y - 0.3, 1.8, 0, TWO_PI);
                octx.fillStyle = dotHighlight;
                octx.fill();
                // core
                octx.beginPath();
                octx.arc(x, y, 1.5, 0, TWO_PI);
                octx.fillStyle = dotCore;
                octx.fill();
            }
        }
        createImageBitmap(offscreen).then(bmp => {
            dotPatternRef.current = bmp;
            dotPatternDimsRef.current = { w, h };
        });
    }, []);

    // Force re-render of pattern when theme or spacing changes
    useEffect(() => {
        dotPatternRef.current = null;
        dotPatternDimsRef.current = { w: 0, h: 0 };
    }, [isDarkMode, GRID_SPACING]);

    // ── Main animation loop ────────────────────────────────────
    useEffect(() => {
        if (dims.w === 0 || dims.h === 0) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        buildDotPattern(dims.w, dims.h, isDarkMode, GRID_SPACING);

        const cx = dims.w / 2;
        const cy = dims.h / 2;
        bodyX.set(cx);
        bodyY.set(cy);
        mouseRef.current.x = cx;
        mouseRef.current.y = cy;

        if (legsRef.current.length !== LEG_COUNT) {
            legsRef.current = [];
            for (let i = 0; i < LEG_COUNT; i++) {
                legsRef.current.push({
                    target: null,
                    current: { x: cx, y: cy },
                    previous: { x: cx, y: cy },
                    stepping: false,
                    stepProgress: 0,
                    planted: false,
                });
            }
        }

        // Reusable typed arrays for feet positions (avoid allocations)
        const feetX = new Float32Array(LEG_COUNT);
        const feetY = new Float32Array(LEG_COUNT);

        const animate = () => {
            const nowTime = Date.now();
            const nowSec = nowTime * 0.001;

            // ── Path Following: Move target towards mouse capped by MAX_SPEED ──
            const curTX = bodyX.get();
            const curTY = bodyY.get();
            const mdx = mouseRef.current.x - curTX;
            const mdy = mouseRef.current.y - curTY;
            const mDistSq = mdx * mdx + mdy * mdy;

            if (mDistSq > 1) {
                const mDist = Math.sqrt(mDistSq);
                const step = Math.min(mDist, MAX_SPEED);
                bodyX.set(curTX + (mdx / mDist) * step);
                bodyY.set(curTY + (mdy / mDist) * step);
            }

            const bx = springX.get();
            const by = springY.get();

            const colors = isDarkMode ? THEME.dark : THEME.light;
            const toMouse = Math.atan2(mouseRef.current.y - by, mouseRef.current.x - bx);

            // ── Collect nearby grid dots into typed arrays ──────
            let nearbyX = nearbyXRef.current;
            let nearbyY = nearbyYRef.current;
            let dotCount = 0;

            const minCol = Math.max(0, Math.floor((bx - LEG_REACH) / GRID_SPACING));
            const maxCol = Math.min(Math.floor(dims.w / GRID_SPACING), Math.ceil((bx + LEG_REACH) / GRID_SPACING));
            const minRow = Math.max(0, Math.floor((by - LEG_REACH) / GRID_SPACING));
            const maxRow = Math.min(Math.floor(dims.h / GRID_SPACING), Math.ceil((by + LEG_REACH) / GRID_SPACING));

            for (let c = minCol; c <= maxCol; c++) {
                for (let r = minRow; r <= maxRow; r++) {
                    const dx = c * GRID_SPACING - bx;
                    const dy = r * GRID_SPACING - by;
                    const dSq = dx * dx + dy * dy;
                    if (dSq <= LEG_REACH_SQ && dSq > BODY_RADIUS_PLUS_5_SQ) {
                        // Grow arrays if needed
                        if (dotCount >= nearbyX.length) {
                            const newX = new Float32Array(nearbyX.length * 2);
                            const newY = new Float32Array(nearbyY.length * 2);
                            newX.set(nearbyX);
                            newY.set(nearbyY);
                            nearbyX = newX;
                            nearbyY = newY;
                            nearbyXRef.current = newX;
                            nearbyYRef.current = newY;
                        }
                        nearbyX[dotCount] = c * GRID_SPACING;
                        nearbyY[dotCount] = r * GRID_SPACING;
                        dotCount++;
                    }
                }
            }

            const usedDots = usedDotsRef.current;
            usedDots.clear();
            const legs = legsRef.current;

            // ── Mark dots claimed by planted legs ──────────────
            for (let i = 0; i < LEG_COUNT; i++) {
                const leg = legs[i];
                if (leg.target && leg.planted && !leg.stepping) {
                    // Find index of this target in nearby dots
                    for (let j = 0; j < dotCount; j++) {
                        if (nearbyX[j] === leg.target.x && nearbyY[j] === leg.target.y) {
                            usedDots.add(j);
                            break;
                        }
                    }
                }
            }

            // A dot is active if it's the target of any leg
            const isDotActive = (tx: number, ty: number) => {
                for (let i = 0; i < LEG_COUNT; i++) {
                    const t = legs[i].target;
                    if (t && t.x === tx && t.y === ty) return true;
                }
                return false;
            };

            // ── Determine which legs need to step ──────────────
            const needsStepA: number[] = [];
            const needsStepB: number[] = [];
            for (let i = 0; i < LEG_COUNT; i++) {
                const leg = legs[i];
                if (leg.stepping) continue;
                const t = leg.target;
                if (!t) {
                    (GAIT_GROUP_A.has(i) ? needsStepA : needsStepB).push(i);
                    continue;
                }
                const dSq = distSq(t.x, t.y, bx, by);
                if (dSq > STEP_THRESHOLD_SQ || dSq < STEP_TOO_CLOSE_SQ) {
                    (GAIT_GROUP_A.has(i) ? needsStepA : needsStepB).push(i);
                }
            }

            // ── Alternating gait ───────────────────────────────
            const primaryNeedsStep = gaitPhaseRef.current === 'A' ? needsStepA : needsStepB;
            const secondaryNeedsStep = gaitPhaseRef.current === 'A' ? needsStepB : needsStepA;

            const doSteps = (indices: number[]) => {
                for (const i of indices) {
                    const leg = legs[i];
                    const idx = findBestDotForLeg(bx, by, toMouse + LEG_ANGLE_OFFSETS[i], nearbyX, nearbyY, dotCount, usedDots, LEG_REACH_SQ, BODY_RADIUS_PLUS_8_SQ);
                    if (idx >= 0) {
                        usedDots.add(idx);
                        const nx = nearbyX[idx];
                        const ny = nearbyY[idx];
                        leg.previous.x = leg.current.x;
                        leg.previous.y = leg.current.y;
                        leg.target = { x: nx, y: ny };
                        leg.stepping = true;
                        leg.stepProgress = 0;
                        leg.planted = false;
                    }
                }
            };

            if (primaryNeedsStep.length > 0) {
                doSteps(primaryNeedsStep);
                gaitPhaseRef.current = gaitPhaseRef.current === 'A' ? 'B' : 'A';
            } else if (secondaryNeedsStep.length > 0) {
                doSteps(secondaryNeedsStep);
                gaitPhaseRef.current = gaitPhaseRef.current === 'A' ? 'B' : 'A';
            }

            // ── Animate legs ───────────────────────────────────
            let feetCount = 0;
            for (let i = 0; i < LEG_COUNT; i++) {
                const leg = legs[i];
                if (leg.stepping && leg.target) {
                    leg.stepProgress = Math.min(1, leg.stepProgress + STEP_SPEED);
                    const t = leg.stepProgress;
                    const ease = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
                    const ix = leg.previous.x + (leg.target.x - leg.previous.x) * ease;
                    const iy = leg.previous.y + (leg.target.y - leg.previous.y) * ease;
                    const lift = 4 * t * (1 - t) * STEP_LIFT_HEIGHT;
                    leg.current.x = ix;
                    leg.current.y = iy - lift;
                    if (t >= 1) {
                        leg.current.x = leg.target.x;
                        leg.current.y = leg.target.y;
                        leg.stepping = false;
                        leg.planted = true;
                    }
                } else if (!leg.target) {
                    leg.current.x += (bx - leg.current.x) * 0.1;
                    leg.current.y += (by - leg.current.y) * 0.1;
                }
                // Collect feet
                if (distSq(leg.current.x, leg.current.y, bx, by) > BODY_RADIUS_PLUS_2_SQ) {
                    feetX[feetCount] = leg.current.x;
                    feetY[feetCount] = leg.current.y;
                    feetCount++;
                }
            }

            // ── DRAW ───────────────────────────────────────────
            ctx.clearRect(0, 0, dims.w, dims.h);

            // 1) Blit pre-rendered dot pattern
            if (showGrid && dotPatternRef.current) {
                ctx.drawImage(dotPatternRef.current, 0, 0);
            }

            if (showGrid) {
                // 2) Overdraw active/pulled dots
                const pulse = 0.5 + 0.5 * Math.sin(nowTime * 0.005);
                const cols = Math.floor(dims.w / GRID_SPACING) + 1;
                const rows = Math.floor(dims.h / GRID_SPACING) + 1;

                // Only check dots near feet for magnetic pull (skip far dots)
                const pullCheckRange = MAG_DOT_PULL_RADIUS + GRID_SPACING;
                for (let fi = 0; fi < feetCount; fi++) {
                    const fx = feetX[fi];
                    const fy = feetY[fi];
                    const cMin = Math.max(0, Math.floor((fx - pullCheckRange) / GRID_SPACING));
                    const cMax = Math.min(cols - 1, Math.ceil((fx + pullCheckRange) / GRID_SPACING));
                    const rMin = Math.max(0, Math.floor((fy - pullCheckRange) / GRID_SPACING));
                    const rMax = Math.min(rows - 1, Math.ceil((fy + pullCheckRange) / GRID_SPACING));

                    for (let c = cMin; c <= cMax; c++) {
                        for (let r = rMin; r <= rMax; r++) {
                            const ox = c * GRID_SPACING;
                            const oy = r * GRID_SPACING;

                            if (isDotActive(ox, oy)) continue;

                            const fdSq = distSq(ox, oy, fx, fy);
                            if (fdSq < MAG_DOT_PULL_RADIUS_SQ && fdSq > 1) {
                                const fd = Math.sqrt(fdSq);
                                const t = 1 - fd / MAG_DOT_PULL_RADIUS;
                                const pull = t * t * MAG_DOT_PULL_STRENGTH;
                                const px = ox + ((fx - ox) / fd) * pull;
                                const py = oy + ((fy - oy) / fd) * pull;

                                const sz = 2 + t * 2;
                                ctx.beginPath();
                                ctx.arc(px + 0.8, py + 0.8, sz, 0, TWO_PI);
                                ctx.fillStyle = colors.neuShadow;
                                ctx.fill();
                                ctx.beginPath();
                                ctx.arc(px - 0.4, py - 0.4, sz - 0.5, 0, TWO_PI);
                                ctx.fillStyle = colors.neuLight;
                                ctx.fill();
                                ctx.beginPath();
                                ctx.arc(px, py, sz - 1, 0, TWO_PI);
                                // Optimization: avoid template literals and toFixed if possible
                                ctx.fillStyle = colors.pulledDotCore + (0.2 + t * 0.4) + ')';
                                ctx.fill();
                            }
                        }
                    }
                }

                // Draw active (grabbed) dots - iterate over legs instead of activeKeys set
                for (let i = 0; i < LEG_COUNT; i++) {
                    const leg = legs[i];
                    if (leg.target) {
                        const ax = leg.target.x;
                        const ay = leg.target.y;
                        // Neumorphic grabbed
                        ctx.beginPath();
                        ctx.arc(ax + 1, ay + 1, 6, 0, TWO_PI);
                        ctx.fillStyle = colors.neuShadow;
                        ctx.fill();
                        ctx.beginPath();
                        ctx.arc(ax - 0.5, ay - 0.5, 5, 0, TWO_PI);
                        ctx.fillStyle = colors.neuLight;
                        ctx.fill();
                        ctx.beginPath();
                        ctx.arc(ax, ay, 4, 0, TWO_PI);
                        ctx.fillStyle = colors.grabbedDotCore;
                        ctx.fill();
                        ctx.beginPath();
                        ctx.arc(ax, ay, 2.5, 0, TWO_PI);
                        ctx.fillStyle = colors.activeDot;
                        ctx.fill();
                    }
                }

                // 3) Magnetic arcs — only draw a few per foot
                for (let fi = 0; fi < feetCount; fi++) {
                    const fx = feetX[fi];
                    const fy = feetY[fi];
                    let arcCount = 0;
                    for (let j = 0; j < dotCount && arcCount < 3; j++) {
                        const dx = nearbyX[j] - fx;
                        const dy = nearbyY[j] - fy;
                        const fdSq = dx * dx + dy * dy;
                        if (fdSq < MAG_ARC_RADIUS_SQ && fdSq > 16) {
                            if (isDotActive(nearbyX[j], nearbyY[j])) continue;
                            const fd = Math.sqrt(fdSq);
                            const t = 1 - fd / MAG_ARC_RADIUS;
                            const flicker = 0.4 + 0.6 * Math.abs(Math.sin(nowSec * 8 + fd));
                            ctx.beginPath();
                            ctx.moveTo(fx, fy);
                            const mx = (fx + nearbyX[j]) * 0.5 + Math.sin(nowSec * 5 + fd) * 5 * t;
                            const my = (fy + nearbyY[j]) * 0.5 + Math.cos(nowSec * 5 + fd) * 5 * t;
                            ctx.quadraticCurveTo(mx, my, nearbyX[j], nearbyY[j]);
                            ctx.strokeStyle = colors.magneticArc + (t * 0.2 * flicker) + ')';
                            ctx.lineWidth = 0.5 + t * 0.5;
                            ctx.stroke();
                            arcCount++;
                        }
                    }
                }
            } // end showGrid


            // 4) Draw legs ──────────────────────────────────────

            // Batch femur segments
            ctx.lineCap = 'round';

            // Shadows
            ctx.beginPath();
            ctx.strokeStyle = colors.bodyShadow;
            ctx.lineWidth = 3;
            for (let i = 0; i < LEG_COUNT; i++) {
                const leg = legs[i];
                const fx = leg.current.x, fy = leg.current.y;
                const dSq = distSq(fx, fy, bx, by);
                if (dSq < BODY_RADIUS_PLUS_2_SQ) continue;
                const dx = fx - bx, dy = fy - by;
                const len = Math.sqrt(dSq);
                const perpX = -dy / len, perpY = dx / len;
                const side = i < 4 ? -1 : 1;
                const kx = bx + dx * 0.38 + perpX * (len * 0.45) * side;
                const ky = by + dy * 0.38 + perpY * (len * 0.45) * side;
                ctx.moveTo(bx + 1, by + 1);
                ctx.lineTo(kx + 1, ky + 1);
            }
            ctx.stroke();

            // Main femur
            ctx.beginPath();
            ctx.strokeStyle = colors.spiderLeg;
            ctx.lineWidth = 2.2;
            for (let i = 0; i < LEG_COUNT; i++) {
                const leg = legs[i];
                const fx = leg.current.x, fy = leg.current.y;
                const dSq = distSq(fx, fy, bx, by);
                if (dSq < BODY_RADIUS_PLUS_2_SQ) continue;
                const dx = fx - bx, dy = fy - by;
                const len = Math.sqrt(dSq);
                const perpX = -dy / len, perpY = dx / len;
                const side = i < 4 ? -1 : 1;
                const kx = bx + dx * 0.38 + perpX * (len * 0.45) * side;
                const ky = by + dy * 0.38 + perpY * (len * 0.45) * side;
                ctx.moveTo(bx, by);
                ctx.lineTo(kx, ky);
            }
            ctx.stroke();

            // Femur highlights
            ctx.beginPath();
            ctx.strokeStyle = colors.spiderLegHighlight;
            ctx.lineWidth = 0.7;
            for (let i = 0; i < LEG_COUNT; i++) {
                const leg = legs[i];
                const fx = leg.current.x, fy = leg.current.y;
                const dSq = distSq(fx, fy, bx, by);
                if (dSq < BODY_RADIUS_PLUS_2_SQ) continue;
                const dx = fx - bx, dy = fy - by;
                const len = Math.sqrt(dSq);
                const perpX = -dy / len, perpY = dx / len;
                const side = i < 4 ? -1 : 1;
                const kx = bx + dx * 0.38 + perpX * (len * 0.45) * side;
                const ky = by + dy * 0.38 + perpY * (len * 0.45) * side;
                ctx.moveTo(bx - 0.4, by - 0.4);
                ctx.lineTo(kx - 0.4, ky - 0.4);
            }
            ctx.stroke();

            // Tibia Shadows
            ctx.beginPath();
            ctx.strokeStyle = colors.jointShadow;
            ctx.lineWidth = 2.2;
            for (let i = 0; i < LEG_COUNT; i++) {
                const leg = legs[i];
                const fx = leg.current.x, fy = leg.current.y;
                const dSq = distSq(fx, fy, bx, by);
                if (dSq < BODY_RADIUS_PLUS_2_SQ) continue;
                const dx = fx - bx, dy = fy - by;
                const len = Math.sqrt(dSq);
                const perpX = -dy / len, perpY = dx / len;
                const side = i < 4 ? -1 : 1;
                const kx = bx + dx * 0.38 + perpX * (len * 0.45) * side;
                const ky = by + dy * 0.38 + perpY * (len * 0.45) * side;
                ctx.moveTo(kx + 1, ky + 1);
                ctx.lineTo(fx + 1, fy + 1);
            }
            ctx.stroke();

            // Tibia Main
            ctx.beginPath();
            ctx.strokeStyle = colors.spiderLeg;
            ctx.lineWidth = 1.5;
            for (let i = 0; i < LEG_COUNT; i++) {
                const leg = legs[i];
                const fx = leg.current.x, fy = leg.current.y;
                const dSq = distSq(fx, fy, bx, by);
                if (dSq < BODY_RADIUS_PLUS_2_SQ) continue;
                const dx = fx - bx, dy = fy - by;
                const len = Math.sqrt(dSq);
                const perpX = -dy / len, perpY = dx / len;
                const side = i < 4 ? -1 : 1;
                const kx = bx + dx * 0.38 + perpX * (len * 0.45) * side;
                const ky = by + dy * 0.38 + perpY * (len * 0.45) * side;
                ctx.moveTo(kx, ky);
                ctx.lineTo(fx, fy);
            }
            ctx.stroke();

            // Tibia Highlights
            ctx.beginPath();
            ctx.strokeStyle = colors.spiderLegHighlight;
            ctx.lineWidth = 0.5;
            for (let i = 0; i < LEG_COUNT; i++) {
                const leg = legs[i];
                const fx = leg.current.x, fy = leg.current.y;
                const dSq = distSq(fx, fy, bx, by);
                if (dSq < BODY_RADIUS_PLUS_2_SQ) continue;
                const dx = fx - bx, dy = fy - by;
                const len = Math.sqrt(dSq);
                const perpX = -dy / len, perpY = dx / len;
                const side = i < 4 ? -1 : 1;
                const kx = bx + dx * 0.38 + perpX * (len * 0.45) * side;
                const ky = by + dy * 0.38 + perpY * (len * 0.45) * side;
                ctx.moveTo(kx - 0.3, ky - 0.3);
                ctx.lineTo(fx - 0.3, fy - 0.3);
            }
            ctx.stroke();

            // Joints and Feet (less critical to batch but good for consistency)
            for (let i = 0; i < LEG_COUNT; i++) {
                const leg = legs[i];
                const fx = leg.current.x, fy = leg.current.y;
                const dSq = distSq(fx, fy, bx, by);
                if (dSq < BODY_RADIUS_PLUS_2_SQ) continue;

                const dx = fx - bx, dy = fy - by;
                const len = Math.sqrt(dSq);
                const perpX = -dy / len, perpY = dx / len;
                const side = i < 4 ? -1 : 1;
                const kx = bx + dx * 0.38 + perpX * (len * 0.45) * side;
                const ky = by + dy * 0.38 + perpY * (len * 0.45) * side;

                // Knee joint
                ctx.beginPath();
                ctx.arc(kx + 0.5, ky + 0.5, 2.8, 0, TWO_PI);
                ctx.fillStyle = colors.jointShadow;
                ctx.fill();
                ctx.beginPath();
                ctx.arc(kx, ky, 2.2, 0, TWO_PI);
                ctx.fillStyle = colors.spiderSheen;
                ctx.fill();

                // Foot tip
                ctx.beginPath();
                ctx.arc(fx, fy, 1.2, 0, TWO_PI);
                ctx.fillStyle = leg.planted ? colors.spiderAccent : colors.spiderSheen;
                ctx.fill();
            }

            // 5) Spider body ────────────────────────────────────
            const nowPulse = Math.sin(nowTime * 0.005);
            const cosM = Math.cos(toMouse);
            const sinM = Math.sin(toMouse);

            // Abdomen
            const abdomenX = bx - cosM * (BODY_RADIUS + ABDOMEN_RX - 4);
            const abdomenY = by - sinM * (BODY_RADIUS + ABDOMEN_RY - 4);

            ctx.beginPath();
            ctx.ellipse(abdomenX + 2, abdomenY + 2, ABDOMEN_RX + 2, ABDOMEN_RY + 1, toMouse + Math.PI, 0, TWO_PI);
            ctx.fillStyle = colors.bodyShadow;
            ctx.fill();

            const abdGrad = ctx.createRadialGradient(abdomenX - 3, abdomenY - 3, 1, abdomenX, abdomenY, ABDOMEN_RX);
            abdGrad.addColorStop(0, colors.spiderSheen);
            abdGrad.addColorStop(0.3, colors.spiderGloss);
            abdGrad.addColorStop(1, colors.spiderBase);
            ctx.beginPath();
            ctx.ellipse(abdomenX, abdomenY, ABDOMEN_RX, ABDOMEN_RY, toMouse + Math.PI, 0, TWO_PI);
            ctx.fillStyle = abdGrad;
            ctx.fill();

            // Hourglass (keeping it subtle red)
            const hgAngle = toMouse + Math.PI;
            const perpHgX = -Math.sin(hgAngle);
            const perpHgY = Math.cos(hgAngle);
            const dirHgX = Math.cos(hgAngle);
            const dirHgY = Math.sin(hgAngle);
            const hgSize = 5;

            const hgGlow = ctx.createRadialGradient(abdomenX, abdomenY, 0, abdomenX, abdomenY, hgSize + 3);
            hgGlow.addColorStop(0, 'rgba(255, 30, 30, 0.3)');
            hgGlow.addColorStop(1, 'rgba(255, 30, 30, 0)');
            ctx.beginPath();
            ctx.arc(abdomenX, abdomenY, hgSize + 3, 0, TWO_PI);
            ctx.fillStyle = hgGlow;
            ctx.fill();

            ctx.beginPath();
            ctx.moveTo(abdomenX, abdomenY);
            ctx.lineTo(abdomenX + dirHgX * hgSize + perpHgX * hgSize * 0.6, abdomenY + dirHgY * hgSize + perpHgY * hgSize * 0.6);
            ctx.lineTo(abdomenX + dirHgX * hgSize - perpHgX * hgSize * 0.6, abdomenY + dirHgY * hgSize - perpHgY * hgSize * 0.6);
            ctx.closePath();
            ctx.fillStyle = isDarkMode ? '#ff1e1e' : '#cc2222';
            ctx.fill();

            ctx.beginPath();
            ctx.moveTo(abdomenX, abdomenY);
            ctx.lineTo(abdomenX - dirHgX * hgSize + perpHgX * hgSize * 0.6, abdomenY - dirHgY * hgSize + perpHgY * hgSize * 0.6);
            ctx.lineTo(abdomenX - dirHgX * hgSize - perpHgX * hgSize * 0.6, abdomenY - dirHgY * hgSize - perpHgY * hgSize * 0.6);
            ctx.closePath();
            ctx.fillStyle = isDarkMode ? '#ff1e1e' : '#cc2222';
            ctx.fill();

            // Abdomen highlight
            ctx.beginPath();
            ctx.ellipse(
                abdomenX - Math.cos(hgAngle) * 3 - sinM * 3,
                abdomenY - Math.sin(hgAngle) * 3 + cosM * 3,
                ABDOMEN_RX * 0.45, ABDOMEN_RY * 0.3, hgAngle, 0, TWO_PI
            );
            ctx.fillStyle = 'rgba(120,120,120,0.2)';
            ctx.fill();

            // Cephalothorax
            ctx.beginPath();
            ctx.arc(bx + 1.5, by + 1.5, BODY_RADIUS + 1, 0, TWO_PI);
            ctx.fillStyle = colors.bodyShadow;
            ctx.fill();

            const bodyGrad = ctx.createRadialGradient(bx - 2, by - 2, 1, bx, by, BODY_RADIUS);
            bodyGrad.addColorStop(0, colors.spiderSheen);
            bodyGrad.addColorStop(0.4, colors.spiderGloss);
            bodyGrad.addColorStop(1, colors.spiderBase);
            ctx.beginPath();
            ctx.arc(bx, by, BODY_RADIUS, 0, TWO_PI);
            ctx.fillStyle = bodyGrad;
            ctx.fill();

            // Head
            const headX = bx + cosM * (BODY_RADIUS + HEAD_RADIUS - 3);
            const headY = by + sinM * (BODY_RADIUS + HEAD_RADIUS - 3);

            ctx.beginPath();
            ctx.arc(headX + 1, headY + 1, HEAD_RADIUS + 0.5, 0, TWO_PI);
            ctx.fillStyle = colors.bodyShadow;
            ctx.fill();

            const headGrad = ctx.createRadialGradient(headX - 1, headY - 1, 0, headX, headY, HEAD_RADIUS);
            headGrad.addColorStop(0, colors.spiderSheen);
            headGrad.addColorStop(0.5, colors.spiderGloss);
            headGrad.addColorStop(1, colors.spiderBase);
            ctx.beginPath();
            ctx.arc(headX, headY, HEAD_RADIUS, 0, TWO_PI);
            ctx.fillStyle = headGrad;
            ctx.fill();

            // Eyes
            const eyeSpread = 2.5;
            const perpEyeX = -sinM * eyeSpread;
            const perpEyeY = cosM * eyeSpread;
            const eyeForward = HEAD_RADIUS * 0.25;

            for (let s = -1; s <= 1; s += 2) {
                const ex = headX + cosM * eyeForward + perpEyeX * s;
                const ey = headY + sinM * eyeForward + perpEyeY * s;
                ctx.beginPath();
                ctx.arc(ex, ey, EYE_RADIUS + 1.5, 0, TWO_PI);
                ctx.fillStyle = colors.eyeGlow;
                ctx.fill();
                ctx.beginPath();
                ctx.arc(ex, ey, EYE_RADIUS, 0, TWO_PI);
                ctx.fillStyle = isDarkMode ? colors.spiderAccentBright : colors.spiderAccent;
                ctx.fill();
                ctx.beginPath();
                ctx.arc(ex - 0.4, ey - 0.4, 0.6, 0, TWO_PI);
                ctx.fillStyle = isDarkMode ? '#fff' : 'rgba(255,255,255,0.8)';
                ctx.fill();
            }

            for (let s = -1; s <= 1; s += 2) {
                const ex = headX + cosM * (eyeForward + 1.5) + perpEyeX * s * 0.5;
                const ey = headY + sinM * (eyeForward + 1.5) + perpEyeY * s * 0.5;
                ctx.beginPath();
                ctx.arc(ex, ey, 1.2, 0, TWO_PI);
                ctx.fillStyle = colors.spiderAccent;
                ctx.fill();
            }

            // Fangs
            for (let s = -1; s <= 1; s += 2) {
                const fbx = headX + cosM * HEAD_RADIUS;
                const fby = headY + sinM * HEAD_RADIUS;
                const ftx = fbx + cosM * 4 + perpEyeX * s * 0.4;
                const fty = fby + sinM * 4 + perpEyeY * s * 0.4;
                ctx.beginPath();
                ctx.moveTo(fbx, fby);
                ctx.lineTo(ftx, fty);
                ctx.strokeStyle = colors.spiderSheen;
                ctx.lineWidth = 1.2;
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(ftx, fty, 0.8, 0, TWO_PI);
                ctx.fillStyle = colors.spiderAccent;
                ctx.fill();
            }

            // Body glow
            const glowGrad = ctx.createRadialGradient(bx, by, 0, bx, by, 40);
            glowGrad.addColorStop(0, isDarkMode ? 'rgba(160,160,160,0.04)' : 'rgba(0,0,0,0.02)');
            glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.beginPath();
            ctx.arc(bx, by, 40, 0, TWO_PI);
            ctx.fillStyle = glowGrad;
            ctx.fill();

            animFrameRef.current = requestAnimationFrame(animate);
        };

        animFrameRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animFrameRef.current);
    }, [dims, springX, springY, buildDotPattern, bodyX, bodyY, config]);

    return (
        <div
            ref={containerRef}
            className="relative w-full h-full min-h-screen overflow-hidden cursor-none"
            style={{
                background: 'transparent',
            }}
        >
            <canvas
                ref={canvasRef}
                width={dims.w}
                height={dims.h}
                className="absolute inset-0"
                style={{ width: '100%', height: '100%' }}
            />


        </div>
    );
}
