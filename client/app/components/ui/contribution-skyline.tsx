"use client";

import * as React from "react";

/**
 * Contribution Skyline — a year of activity as a GitHub-style heat map that
 * folds up into an isometric skyline, and back down again.
 *
 * It is one scene, not two charts. Every day is a box on a grid; the 2D view
 * is that grid seen straight down, the 3D view is the same grid seen from the
 * corner. Switching views swings one camera between the two while each week's
 * bars rise (or settle) in a wave from the oldest week to the newest, so the
 * flat heat map visibly becomes the skyline — nothing is swapped or cut.
 *
 * Hover or tap a day for its count, arrow keys walk the grid, hover a legend
 * swatch to isolate that level, and in 3D drag to orbit (double-click resets).
 * Palette and theme changes blend rather than flip.
 *
 * Canvas + DOM, React is the only import. Pass `data` as `{ date, count }[]`;
 * without it an empty calendar is shown. No activity is fabricated.
 */

// #region contributions
// Pure: dates, grid, stats, levels, camera and colour maths. Lifted out and run by the test.

export type ContributionDay = { date: string; count: number };
export type Cell = { date: string; count: number; level: number; week: number; day: number };
export type Streak = { days: number; start: string | null; end: string | null };
export type ContributionStats = {
  total: number;
  first: string | null;
  last: string | null;
  busiest: { count: number; date: string | null };
  longest: Streak;
  current: Streak;
};
export type RGB = [number, number, number];

export const DAY_MS = 86400000;

export const clamp01 = (v: number): number => (v > 0 ? (v < 1 ? v : 1) : 0);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const easeInOutCubic = (x: number): number => {
  const t = clamp01(x);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
export const easeOutCubic = (x: number): number => 1 - Math.pow(1 - clamp01(x), 3);
export const smoothstep = (a: number, b: number, x: number): number => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** UTC midnight → "YYYY-MM-DD". */
export const toKey = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/**
 * Any date-ish value → UTC midnight of its calendar day. "YYYY-MM-DD" strings
 * are read literally (no timezone drift), Date objects by their local day,
 * numbers as UTC timestamps.
 */
export const dayMs = (v: string | number | Date): number => {
  if (typeof v === "number") return Math.floor(v / DAY_MS) * DAY_MS;
  if (typeof v === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
    if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
    v = new Date(v);
  }
  return Date.UTC(v.getFullYear(), v.getMonth(), v.getDate());
};

/**
 * The grid: columns are weeks, rows are weekdays (row 0 = `weekStart`). It
 * ends on `endMs` and starts on the week containing the day one year earlier.
 * Levels 1–4 split the non-zero days by their share of a busy day — the 95th
 * percentile, so one freak day can't wash every other day out to level 1.
 */
export const buildGrid = (data: ContributionDay[], endMs: number, weekStart = 0) => {
  const counts = new Map<string, number>();
  for (const d of data) {
    if (!d || typeof d.date !== "string") continue;
    const ms = dayMs(d.date);
    const c = Number(d.count);
    if (!Number.isFinite(ms) || !(c > 0) || !Number.isFinite(c)) continue;
    const k = toKey(ms);
    counts.set(k, (counts.get(k) ?? 0) + c);
  }
  let start = endMs - 364 * DAY_MS;
  start -= ((new Date(start).getUTCDay() - weekStart + 7) % 7) * DAY_MS;
  const cells: Cell[] = [];
  for (let ms = start, i = 0; ms <= endMs; ms += DAY_MS, i++) {
    const date = toKey(ms);
    cells.push({
      date,
      count: counts.get(date) ?? 0,
      level: 0,
      week: Math.floor(i / 7),
      day: i % 7,
    });
  }
  const nz = cells
    .map((c) => c.count)
    .filter((c) => c > 0)
    .sort((a, b) => a - b);
  const busy = nz.length ? nz[Math.floor(0.95 * (nz.length - 1))] : 0;
  for (const c of cells) c.level = levelOf(c.count, busy);
  return {
    cells,
    weeks: cells.length ? cells[cells.length - 1].week + 1 : 0,
    max: nz.length ? nz[nz.length - 1] : 0,
  };
};

/** 0 for an empty day, else 1–4 by quarters of `busy`. Anything at or past `busy` is 4. */
export const levelOf = (count: number, busy: number): number =>
  count <= 0 ? 0 : busy <= 0 ? 4 : 1 + Math.min(3, Math.floor((count / busy) * 4));

/** Total, busiest day, longest run, and the run that reaches today (or yesterday — today isn't over). */
export const computeStats = (cells: Cell[]): ContributionStats => {
  let total = 0;
  let best = 0;
  let bestDate: string | null = null;
  let run = 0;
  let runStart: string | null = null;
  let longest: Streak = { days: 0, start: null, end: null };
  for (const c of cells) {
    total += c.count;
    if (c.count > best) {
      best = c.count;
      bestDate = c.date;
    }
    if (c.count > 0) {
      if (run === 0) runStart = c.date;
      run++;
      if (run > longest.days) longest = { days: run, start: runStart, end: c.date };
    } else run = 0;
  }
  let j = cells.length - 1;
  if (j >= 0 && cells[j].count === 0) j--;
  const endAt = j;
  while (j >= 0 && cells[j].count > 0) j--;
  const days = endAt - j;
  const current: Streak =
    days > 0
      ? { days, start: cells[j + 1].date, end: cells[endAt].date }
      : { days: 0, start: null, end: null };
  return {
    total,
    first: cells.length ? cells[0].date : null,
    last: cells.length ? cells[cells.length - 1].date : null,
    busiest: { count: best, date: bestDate },
    longest,
    current,
  };
};

/** A label on each week whose first day starts a new month; a cramped first label is dropped. */
export const monthLabels = (cells: Cell[], weeks: number, locale = "en-US") => {
  const fmt = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" });
  const out: { week: number; label: string }[] = [];
  let prev = -1;
  for (let w = 0; w < weeks; w++) {
    const c = cells[w * 7];
    if (!c) break;
    const m = +c.date.slice(5, 7);
    if (m !== prev) out.push({ week: w, label: fmt.format(dayMs(c.date)) });
    prev = m;
  }
  if (out.length > 1 && out[1].week - out[0].week < 3) out.shift();
  return out;
};

/** Box height in grid units. Empty days are thin slabs; the busiest day is ~7.6 cells tall. */
export const barHeight = (count: number, max: number, scale = 1): number =>
  count > 0 && max > 0 ? 0.4 + Math.pow(count / max, 0.85) * 7.2 * scale : 0.2;

/** Share of the morph each bar spends waiting — the wave sweeps oldest week → newest. */
export const WAVE = 0.42;

/** 0 → 1 as a bar rises during the morph. Every bar is flat at t=0 and fully up at t=1. */
export const riseAt = (t: number, week: number, weeks: number, day: number): number => {
  const d = (weeks > 1 ? week / (weeks - 1) : 0) * 0.36 + (day / 6) * 0.06;
  return easeOutCubic((t - d) / (1 - WAVE));
};

export const YAW_3D = Math.PI / 4;
export const ELEV_3D = (34 * Math.PI) / 180;
export const YAW_RANGE: [number, number] = [(8 * Math.PI) / 180, (82 * Math.PI) / 180];
export const ELEV_RANGE: [number, number] = [(18 * Math.PI) / 180, (62 * Math.PI) / 180];

export type Cam = { cs: number; sn: number; se: number; ce: number };

/**
 * e=0 looks straight down (yaw 0, elevation 90°): x across, y down, height
 * invisible — a plain heat map. e=1 is the isometric corner view. Orbit
 * offsets only apply in proportion to e, so the flat view never tilts.
 */
export const camera = (e: number, dYaw = 0, dElev = 0): Cam => {
  const yaw = Math.min(YAW_RANGE[1], Math.max(0, lerp(0, YAW_3D + dYaw, e)));
  const elev = lerp(
    Math.PI / 2,
    Math.min(ELEV_RANGE[1], Math.max(ELEV_RANGE[0], ELEV_3D + dElev)),
    e,
  );
  return { cs: Math.cos(yaw), sn: Math.sin(yaw), se: Math.sin(elev), ce: Math.cos(elev) };
};

/** World (x = week, y = weekday, z = up) → screen, before scale/offset. */
export const project = (c: Cam, x: number, y: number, z: number): [number, number] => [
  x * c.cs - y * c.sn,
  (x * c.sn + y * c.cs) * c.se - z * c.ce,
];

/** Painter's depth for yaw in [0°, 90°]: larger is nearer the viewer, so draw ascending. */
export const depthOf = (c: Cam, x: number, y: number): number => x * c.sn + y * c.cs;

export const mixRGB = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
export const luminance = (c: RGB): number => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;

export type PaletteName = "primary" | "github" | "halloween" | "ocean" | "ember" | "grape" | "mono";
export type PaletteInput = PaletteName | string[] | { light: string[]; dark: string[] };

const primarySwatches = [25, 50, 75]
  .map((weight) => `color-mix(in srgb, hsl(var(--card)), hsl(var(--primary)) ${weight}%)`)
  .concat("hsl(var(--primary))");

/** Four colours per theme, lightest activity → heaviest. */
export const PALETTES: Record<PaletteName, { light: string[]; dark: string[] }> = {
  primary: { light: primarySwatches, dark: primarySwatches },
  github: {
    light: ["#c6e48b", "#7bc96f", "#239a3b", "#196127"],
    dark: ["#0e4429", "#006d32", "#26a641", "#39d353"],
  },
  halloween: {
    light: ["#ffee4a", "#ffc501", "#fe9600", "#b33c00"],
    dark: ["#631c03", "#bd561d", "#fa7a18", "#fddf68"],
  },
  ocean: {
    light: ["#b8e3f5", "#6ec3eb", "#2a8fd1", "#0b4f8a"],
    dark: ["#0c2d4a", "#12508a", "#2a88d8", "#7cc7ff"],
  },
  ember: {
    light: ["#fde2c4", "#fbad6e", "#f06b3a", "#b3261e"],
    dark: ["#4a1a10", "#8f2f16", "#e0572a", "#ffa46b"],
  },
  grape: {
    light: ["#e4d4fb", "#b794f4", "#805ad5", "#44337a"],
    dark: ["#2d1f4f", "#553c9a", "#8b5cf6", "#c4b5fd"],
  },
  mono: {
    light: ["#d4d4d4", "#a3a3a3", "#525252", "#171717"],
    dark: ["#333333", "#5c5c5c", "#a3a3a3", "#fafafa"],
  },
};

export const resolvePalette = (p: PaletteInput | undefined, dark: boolean): string[] => {
  const pick = Array.isArray(p)
    ? p
    : typeof p === "object" && p
      ? dark
        ? p.dark
        : p.light
      : (PALETTES[p ?? "primary"] ?? PALETTES.primary)[dark ? "dark" : "light"];
  const base = PALETTES.primary[dark ? "dark" : "light"];
  return [0, 1, 2, 3].map((i) => pick[i] ?? pick[pick.length - 1] ?? base[i]);
};
// #endregion

type View = "2d" | "3d";

export interface ContributionSkylineProps {
  /** One entry per day, `YYYY-MM-DD`. Repeated dates add up. Omit for an empty calendar. */
  data?: ContributionDay[];
  /** Last day shown. Defaults to the latest date in `data`, or today. */
  endDate?: string | Date;
  /** Controlled view. */
  view?: View;
  /** Uncontrolled starting view. The 3D view rises out of the flat one when it first scrolls into sight. */
  defaultView?: View;
  onViewChange?: (view: View) => void;
  /** A preset, four colours, or `{ light, dark }` sets of four. */
  palette?: PaletteInput;
  /** Heading. Defaults to "{total} contributions in the last year". */
  title?: React.ReactNode;
  /** Singular noun for a unit of activity. */
  unit?: string;
  /** Plural noun. Defaults to `unit + "s"`. */
  unitPlural?: string;
  /** Multiplies bar heights in 3D. */
  heightScale?: number;
  /** Morph length, ms. */
  duration?: number;
  /** 0 puts Sunday on the top row, 1 puts Monday there. */
  weekStart?: 0 | 1;
  /** Drag to orbit in 3D. */
  orbit?: boolean;
  showStats?: boolean;
  showLegend?: boolean;
  showToggle?: boolean;
  /** Replaces the hint under the chart. `null` renders none. */
  footer?: React.ReactNode;
  locale?: string;
  onCellClick?: (day: ContributionDay) => void;
  /** Minimal presentation integrates into a shared page surface without nested card borders. */
  appearance?: "card" | "minimal";
  className?: string;
}

const FG_FALLBACK: RGB = [23, 23, 23];
const BG_FALLBACK: RGB = [255, 255, 255];

// Any CSS colour → sRGB, by letting the browser paint it. Handles oklch, color-mix, names…
let probe: CanvasRenderingContext2D | null = null;
const toRGB = (color: string, fallback: RGB | null): RGB | null => {
  if (!probe) {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    probe = c.getContext("2d", { willReadFrequently: true });
  }
  if (!probe) return fallback;
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = "rgba(0,0,0,0)";
  probe.fillStyle = color;
  probe.fillRect(0, 0, 1, 1);
  const d = probe.getImageData(0, 0, 1, 1).data;
  if (d[3] < 8) return fallback;
  return [d[0], d[1], d[2]];
};

const rgbString = (r: number, g: number, b: number) =>
  "rgb(" + Math.round(r) + "," + Math.round(g) + "," + Math.round(b) + ")";

const pointInQuad = (p: Float32Array, o: number, x: number, y: number): boolean => {
  let sign = 0;
  for (let k = 0; k < 4; k++) {
    const ax = p[o + k * 2];
    const ay = p[o + k * 2 + 1];
    const bx = p[o + ((k + 1) % 4) * 2];
    const by = p[o + ((k + 1) % 4) * 2 + 1];
    const cross = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
    if (Math.abs(cross) < 1e-9) continue;
    const s = cross > 0 ? 1 : -1;
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return sign !== 0;
};

const quadPath = (ctx: CanvasRenderingContext2D, p: Float32Array, o: number, r: number) => {
  if (r < 0.3) {
    ctx.moveTo(p[o], p[o + 1]);
    ctx.lineTo(p[o + 2], p[o + 3]);
    ctx.lineTo(p[o + 4], p[o + 5]);
    ctx.lineTo(p[o + 6], p[o + 7]);
    ctx.closePath();
    return;
  }
  ctx.moveTo((p[o + 6] + p[o]) / 2, (p[o + 7] + p[o + 1]) / 2);
  for (let k = 0; k < 4; k++) {
    const b = (k + 1) % 4;
    ctx.arcTo(p[o + k * 2], p[o + k * 2 + 1], p[o + b * 2], p[o + b * 2 + 1], r);
  }
  ctx.closePath();
};

const GridIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" style={{ maxWidth: "none" }}>
    <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1" fill="currentColor" />
    <rect x="9" y="1.5" width="5.5" height="5.5" rx="1" fill="currentColor" />
    <rect x="1.5" y="9" width="5.5" height="5.5" rx="1" fill="currentColor" />
    <rect x="9" y="9" width="5.5" height="5.5" rx="1" fill="currentColor" />
  </svg>
);

const CubeIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" style={{ maxWidth: "none" }}>
    <path
      d="M8 1.2 14.2 4.6v6.8L8 14.8 1.8 11.4V4.6Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <path
      d="M1.8 4.6 8 8l6.2-3.4M8 8v6.8"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
);

const MUTED = "hsl(var(--muted-foreground))";

function Stat({
  label,
  value,
  unit,
  sub,
  accent,
  size,
  align,
}: {
  label: string;
  value: string;
  unit: string;
  sub: string;
  accent: string;
  size: number;
  align: "start" | "end" | "stack";
}) {
  if (align === "stack") {
    return (
      <div className="min-w-0">
        <div className="text-[13px] leading-tight" style={{ color: MUTED }}>
          {label}
        </div>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
          <span
            className="font-semibold tabular-nums transition-colors duration-500 motion-reduce:transition-none"
            style={{ color: accent, fontSize: size, lineHeight: 1, letterSpacing: "-0.02em" }}
          >
            {value}
          </span>
          <span className="text-[14px]">{unit}</span>
        </div>
        <div className="mt-0.5 truncate text-[12px]" style={{ color: MUTED }}>
          {sub}
        </div>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-[auto_auto] items-end gap-x-2" style={{ justifyContent: align }}>
      {align === "end" ? (
        <>
          <div className="text-right text-[13px] leading-tight" style={{ color: MUTED }}>
            {label}
          </div>
          <div />
        </>
      ) : (
        <div className="col-span-2 text-[13px] leading-tight" style={{ color: MUTED }}>
          {label}
        </div>
      )}
      <div
        className="text-right font-semibold tabular-nums transition-colors duration-500 motion-reduce:transition-none"
        style={{ color: accent, fontSize: size, lineHeight: 0.95, letterSpacing: "-0.02em" }}
      >
        {value}
      </div>
      <div className="pb-[0.15em] leading-tight">
        <div className="text-[15px]">{unit}</div>
        <div className="whitespace-nowrap text-[13px]" style={{ color: MUTED }}>
          {sub}
        </div>
      </div>
    </div>
  );
}

export default function ContributionSkyline({
  data,
  endDate,
  view: viewProp,
  defaultView = "3d",
  onViewChange,
  palette = "primary",
  title,
  unit = "contribution",
  unitPlural,
  heightScale = 1,
  duration = 1300,
  weekStart = 0,
  orbit = true,
  showStats = true,
  showLegend = true,
  showToggle = true,
  footer,
  locale = "en-US",
  onCellClick,
  appearance = "card",
  className = "",
}: ContributionSkylineProps) {
  const endKey = endDate == null ? null : dayMs(endDate);
  const model = React.useMemo(() => {
    const dates = (data ?? []).map((d) => dayMs(d.date)).filter(Number.isFinite);
    const end = endKey ?? (dates.length ? Math.max(...dates) : dayMs(new Date()));
    const days = data ?? [];
    const grid = buildGrid(days, end, weekStart);
    return {
      ...grid,
      stats: computeStats(grid.cells),
      months: monthLabels(grid.cells, grid.weeks, locale),
    };
  }, [data, endKey, weekStart, locale]);

  const [innerView, setInnerView] = React.useState<View>(defaultView);
  const view = viewProp ?? innerView;
  const setView = (v: View) => {
    if (viewProp === undefined) setInnerView(v);
    onViewChange?.(v);
  };

  const [theme, setTheme] = React.useState<{ dark: boolean; swatches: string[]; accent: string }>(
    () => {
      const p = resolvePalette(palette, false);
      return { dark: false, swatches: ["#ebedf0", ...p], accent: p[3] };
    },
  );
  const [width, setWidth] = React.useState(0);
  const [active, setActive] = React.useState(-1);
  const [legendLevel, setLegendLevel] = React.useState(-1);
  const [announce, setAnnounce] = React.useState("");

  const rootRef = React.useRef<HTMLElement>(null);
  const stageRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const tipRef = React.useRef<HTMLDivElement>(null);
  const engine = React.useRef<{
    kick: () => void;
    load: () => void;
    retheme: () => void;
    tipWidth: (w: number) => void;
  } | null>(null);

  const plural = unitPlural ?? unit + "s";
  const nf = React.useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const df = React.useMemo(
    () => new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "UTC" }),
    [locale],
  );
  const dfy = React.useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      }),
    [locale],
  );
  const dfl = React.useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      }),
    [locale],
  );
  const noun = React.useCallback((n: number) => (n === 1 ? unit : plural), [unit, plural]);
  const describe = React.useCallback(
    (i: number) => {
      const c = model.cells[i];
      if (!c) return "";
      return (
        (c.count ? nf.format(c.count) + " " + noun(c.count) : "No " + plural) +
        " on " +
        dfl.format(dayMs(c.date))
      );
    },
    [model, nf, noun, plural, dfl],
  );

  // Everything the render loop reads, refreshed every render so the loop never closes over stale props.
  const cfg = React.useRef({
    model,
    duration,
    heightScale,
    orbit,
    palette,
    legendLevel,
    onCellClick,
    target: view === "3d" ? 1 : 0,
    setActive,
    setWidth,
    setTheme,
    setAnnounce,
    describe,
  });
  React.useLayoutEffect(() => {
    cfg.current = {
      model,
      duration,
      heightScale,
      orbit,
      palette,
      legendLevel,
      onCellClick,
      target: view === "3d" ? 1 : 0,
      setActive,
      setWidth,
      setTheme,
      setAnnounce,
      describe,
    };
  }, [model, duration, heightScale, orbit, palette, legendLevel, onCellClick, view, describe]);

  React.useEffect(() => {
    const root = rootRef.current;
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    const tip = tipRef.current;
    if (!root || !stage || !canvas || !tip) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const darkMq = window.matchMedia("(prefers-color-scheme: dark)");
    let reduced = reduceMq.matches;

    // morph: t is linear time 0 (2D) → 1 (3D); the camera eases it, the bars wave it
    let t = 0;
    let target = 0;
    let entered = false;
    // orbit offsets, eased toward their goals
    let yaw = 0;
    let elev = 0;
    let yawGoal = 0;
    let elevGoal = 0;
    // layout
    let W = 0;
    let H2 = 0;
    let H3 = 0;
    let Hmax = 0;
    let lastH = -1;
    let dpr = 1;
    let gutter = 30;
    let labelW = 30;
    let font = "10px sans-serif";
    // colours: [empty, l1, l2, l3, l4] × rgb, eased toward the goal
    const col = new Float32Array(15);
    const colGoal = new Float32Array(15);
    let colReady = false;
    let fg: RGB = FG_FALLBACK;
    let bg: RGB = BG_FALLBACK;
    let isDark = false;
    // cells
    let n = 0;
    let weeks = 0;
    let wk = new Float32Array(0);
    let dy = new Float32Array(0);
    let lv = new Uint8Array(0);
    let hgt = new Float32Array(0);
    let zs = new Float32Array(0);
    let hover = new Float32Array(0);
    let dim = new Float32Array(0);
    let polys = new Float32Array(0);
    let faces = new Uint8Array(0);
    let order: number[] = [];
    let months: { week: number; label: string }[] = [];
    let weekdayRows: { day: number; label: string }[] = [];
    // interaction
    let hovered = -1;
    let pinned = -1;
    let activeIdx = -1;
    let tipW = 0;
    let raf = 0;
    let last = 0;

    const load = () => {
      const m = cfg.current.model;
      n = m.cells.length;
      weeks = m.weeks;
      if (wk.length !== n) {
        wk = new Float32Array(n);
        dy = new Float32Array(n);
        lv = new Uint8Array(n);
        hgt = new Float32Array(n);
        zs = new Float32Array(n);
        hover = new Float32Array(n);
        dim = new Float32Array(n);
        polys = new Float32Array(n * 24);
        faces = new Uint8Array(n);
        order = Array.from({ length: n }, (_, i) => i);
      }
      for (let i = 0; i < n; i++) {
        const c = m.cells[i];
        wk[i] = c.week;
        dy[i] = c.day;
        lv[i] = c.level;
        hgt[i] = barHeight(c.count, m.max, cfg.current.heightScale);
      }
      months = m.months;
      const wf = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
      weekdayRows = [];
      for (let d = 0; d < 7 && d < n; d++) {
        const dow = new Date(dayMs(m.cells[d].date)).getUTCDay();
        if (dow === 1 || dow === 3 || dow === 5)
          weekdayRows.push({ day: d, label: wf.format(dayMs(m.cells[d].date)) });
      }
      if (hovered >= n) hovered = -1;
      if (pinned >= n) pinned = -1;
    };

    const retheme = () => {
      const cs = getComputedStyle(root);
      fg = toRGB(cs.color, FG_FALLBACK) ?? FG_FALLBACK;
      const b = toRGB(cs.backgroundColor, null);
      bg = b ?? (luminance(fg) > 0.5 ? [10, 10, 10] : BG_FALLBACK);
      isDark = luminance(bg) < 0.45;
      font = "400 10px " + (cs.fontFamily || "sans-serif");
      const pal = resolvePalette(cfg.current.palette, isDark);
      const empty = mixRGB(bg, fg, isDark ? 0.11 : 0.075);
      // Canvas colours need resolved tokens; CSS variables are inherited from the Console theme.
      const all: RGB[] = [
        empty,
        ...pal.map(
          (c) =>
            toRGB(
              c.replace(/var\((--[\w-]+)\)/g, (_, token: string) =>
                cs.getPropertyValue(token).trim(),
              ),
              FG_FALLBACK,
            ) ?? FG_FALLBACK,
        ),
      ];
      for (let k = 0; k < 5; k++) for (let ch = 0; ch < 3; ch++) colGoal[k * 3 + ch] = all[k][ch];
      if (!colReady || reduced) {
        col.set(colGoal);
        colReady = true;
      }
      ctx.font = font;
      labelW =
        Math.ceil(Math.max(20, ...weekdayRows.map((r) => ctx.measureText(r.label).width))) + 8;
      const sw = all.map((c) => rgbString(c[0], c[1], c[2]));
      cfg.current.setTheme((prev) =>
        prev.dark === isDark && prev.swatches.join() === sw.join()
          ? prev
          : { dark: isDark, swatches: sw, accent: sw[4] },
      );
      kick();
    };

    // Projected extent of the scene for camera e, with each bar at zOf(i).
    const extent = (cam: Cam, e: number, full: boolean) => {
      const w = lerp(0.78, 0.9, e);
      const off = (1 - w) / 2;
      let minx = Infinity;
      let maxx = -Infinity;
      let miny = Infinity;
      let maxy = -Infinity;
      const add = (x: number, y: number, z: number) => {
        const p = project(cam, x, y, z);
        if (p[0] < minx) minx = p[0];
        if (p[0] > maxx) maxx = p[0];
        if (p[1] < miny) miny = p[1];
        if (p[1] > maxy) maxy = p[1];
      };
      for (let i = 0; i < n; i++) {
        const x0 = wk[i] + off;
        const y0 = dy[i] + off;
        const z = full ? hgt[i] * e : zs[i];
        add(x0, y0, z);
        add(x0 + w, y0, z);
        add(x0, y0 + w, z);
        add(x0 + w, y0 + w, 0);
        add(x0, y0 + w, 0);
        add(x0 + w, y0, 0);
      }
      // room for the month labels that run along the front edge in 3D
      add(0, 7 + 1.5 * e, 0);
      add(weeks, 7 + 1.5 * e, 0);
      return { minx, maxx, miny, maxy };
    };

    const relayout = () => {
      const w = Math.round(stage.clientWidth);
      if (!w || !n) return;
      W = w;
      // Narrow cards give the weekday names' column to the grid instead; rows get too tight to label.
      gutter = W < 520 ? 0 : labelW;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      const b2 = extent(camera(0), 0, true);
      H2 = 20 + 4 + ((b2.maxy - b2.miny) / (b2.maxx - b2.minx)) * (W - gutter - 4);
      const b3 = extent(camera(1), 1, true);
      const natural = ((b3.maxy - b3.miny) / (b3.maxx - b3.minx)) * (W - 40) + 40;
      H3 = Math.max(Math.min(natural, W * 0.72, 620), Math.min(natural, 240));
      Hmax = Math.ceil(Math.max(H2, H3));
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(Hmax * dpr);
      canvas.style.width = W + "px";
      canvas.style.height = Hmax + "px";
      lastH = -1;
      cfg.current.setWidth(W);
      draw();
    };

    const draw = () => {
      if (!W || !n) return;
      const e = easeInOutCubic(t);
      const cam = camera(e, yaw, elev);
      const Hc = lerp(H2, H3, e);
      if (Math.abs(Hc - lastH) > 0.2) {
        stage.style.height = Hc.toFixed(1) + "px";
        lastH = Hc;
      }
      for (let i = 0; i < n; i++) zs[i] = riseAt(t, wk[i], weeks, dy[i]) * hgt[i];
      const b = extent(cam, e, false);
      const pad = lerp(2, 20, e);
      const left = pad + gutter * (1 - e);
      const top = pad + 20 * (1 - e);
      const aw = W - left - pad;
      const ah = Hc - top - pad;
      const bw = Math.max(1e-6, b.maxx - b.minx);
      const bh = Math.max(1e-6, b.maxy - b.miny);
      const s = Math.min(aw / bw, ah / bh);
      const ox = left + (aw - bw * s) / 2 - b.minx * s;
      const oy = top + (ah - bh * s) / 2 - b.miny * s;
      const { cs, sn, se, ce } = cam;
      const px = (x: number, y: number) => ox + (x * cs - y * sn) * s;
      const py = (x: number, y: number, z: number) => oy + ((x * sn + y * cs) * se - z * ce) * s;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, Hmax);

      order.sort(
        (a, c) =>
          (wk[a] + 0.5) * sn + (dy[a] + 0.5) * cs - ((wk[c] + 0.5) * sn + (dy[c] + 0.5) * cs),
      );

      const w = lerp(0.78, 0.9, e);
      const off = (1 - w) / 2;
      const radius = lerp(0.17, 0.03, e) * s;
      const outline = (1 - e) * 0.07;
      const lift = 0.7 * e;
      const ex = col[0];
      const ey = col[1];
      const ez = col[2];

      for (let k = 0; k < n; k++) {
        const i = order[k];
        const x0 = wk[i] + off;
        const y0 = dy[i] + off;
        const x1 = x0 + w;
        const y1 = y0 + w;
        const z = zs[i] + hover[i] * lift;
        const o = i * 24;
        // top
        polys[o] = px(x0, y0);
        polys[o + 1] = py(x0, y0, z);
        polys[o + 2] = px(x1, y0);
        polys[o + 3] = py(x1, y0, z);
        polys[o + 4] = px(x1, y1);
        polys[o + 5] = py(x1, y1, z);
        polys[o + 6] = px(x0, y1);
        polys[o + 7] = py(x0, y1, z);
        // +y face (left on screen)
        polys[o + 8] = px(x0, y1);
        polys[o + 9] = py(x0, y1, 0);
        polys[o + 10] = px(x1, y1);
        polys[o + 11] = py(x1, y1, 0);
        polys[o + 12] = polys[o + 4];
        polys[o + 13] = polys[o + 5];
        polys[o + 14] = polys[o + 6];
        polys[o + 15] = polys[o + 7];
        // +x face (right on screen)
        polys[o + 16] = px(x1, y0);
        polys[o + 17] = py(x1, y0, 0);
        polys[o + 18] = polys[o + 10];
        polys[o + 19] = polys[o + 11];
        polys[o + 20] = polys[o + 4];
        polys[o + 21] = polys[o + 5];
        polys[o + 22] = polys[o + 2];
        polys[o + 23] = polys[o + 3];

        const tall = z * ce * s;
        let f = 0;
        if (tall > 0.35 && w * cs * s > 0.35) f |= 1;
        if (tall > 0.35 && w * sn * s > 0.35) f |= 2;
        faces[i] = f;

        const L = lv[i] * 3;
        let r = col[L];
        let g = col[L + 1];
        let bl = col[L + 2];
        const d = dim[i];
        if (d > 0.002) {
          r += (ex - r) * 0.72 * d;
          g += (ey - g) * 0.72 * d;
          bl += (ez - bl) * 0.72 * d;
        }
        const hv = hover[i];
        if (hv > 0.002) {
          const m = 0.16 * hv;
          r += (fg[0] - r) * m;
          g += (fg[1] - g) * m;
          bl += (fg[2] - bl) * m;
        }
        if (f & 1) {
          ctx.beginPath();
          quadPath(ctx, polys, o + 8, 0);
          ctx.fillStyle = rgbString(r * 0.84, g * 0.84, bl * 0.84);
          ctx.fill();
        }
        if (f & 2) {
          ctx.beginPath();
          quadPath(ctx, polys, o + 16, 0);
          ctx.fillStyle = rgbString(r * 0.68, g * 0.68, bl * 0.68);
          ctx.fill();
        }
        ctx.beginPath();
        quadPath(ctx, polys, o, radius);
        ctx.fillStyle = rgbString(r, g, bl);
        ctx.fill();
        if (outline > 0.004) {
          ctx.strokeStyle =
            "rgba(" + fg[0] + "," + fg[1] + "," + fg[2] + "," + outline.toFixed(3) + ")";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        if (hv > 0.02) {
          ctx.strokeStyle =
            "rgba(" + fg[0] + "," + fg[1] + "," + fg[2] + "," + (0.85 * hv).toFixed(3) + ")";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      // Labels: along the top and left in 2D, along the front edge in 3D. They fade, never pop.
      const muted = mixRGB(bg, fg, 0.55);
      ctx.font = font;
      const a2 = 1 - smoothstep(0, 0.4, e);
      const a3 = smoothstep(0.62, 1, e);
      if (a2 > 0.004) {
        ctx.fillStyle =
          "rgba(" +
          Math.round(muted[0]) +
          "," +
          Math.round(muted[1]) +
          "," +
          Math.round(muted[2]) +
          "," +
          a2.toFixed(3) +
          ")";
        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";
        let edge = -Infinity;
        for (const m of months) {
          const x = px(m.week + off, -0.3);
          const tw = ctx.measureText(m.label).width;
          if (x < edge || x + tw > W) continue;
          ctx.fillText(m.label, x, py(m.week + off, -0.3, 0) - 3);
          edge = x + tw + 6;
        }
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        if (gutter > 0)
          for (const r of weekdayRows)
            ctx.fillText(r.label, px(0, r.day + 0.5) - 6, py(0, r.day + 0.5, 0));
      }
      if (a3 > 0.004) {
        ctx.fillStyle =
          "rgba(" +
          Math.round(muted[0]) +
          "," +
          Math.round(muted[1]) +
          "," +
          Math.round(muted[2]) +
          "," +
          a3.toFixed(3) +
          ")";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        let edge = -Infinity;
        for (const m of months) {
          const x = px(m.week + 0.5, 7.3);
          if (x < edge || x + ctx.measureText(m.label).width > W) continue;
          ctx.fillText(m.label, x, py(m.week + 0.5, 7.3, 0) + 2);
          edge = x + ctx.measureText(m.label).width + 10;
        }
      }

      // Tooltip rides the active cell through morphs and orbits.
      if (activeIdx >= 0 && activeIdx < n) {
        const i = activeIdx;
        const z = zs[i] + hover[i] * lift;
        const tx = px(wk[i] + 0.5, dy[i] + 0.5);
        const ty = Math.min(
          py(wk[i] + off, dy[i] + off, z),
          py(wk[i] + off + w, dy[i] + off, z),
          py(wk[i] + off, dy[i] + off + w, z),
        );
        const half = tipW / 2;
        const cx = Math.min(W - half - 2, Math.max(half + 2, tx));
        tip.style.transform =
          "translate(" +
          (cx - half).toFixed(1) +
          "px," +
          (ty - 8).toFixed(1) +
          "px) translateY(-100%)";
        tip.style.setProperty("--arrow", (tx - cx + half).toFixed(1) + "px");
      }
    };

    const tick = (now: number) => {
      raf = 0;
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      let moving = false;

      if (t !== target) {
        const step = reduced ? 1 : (dt * 1000) / Math.max(1, cfg.current.duration);
        t = target > t ? Math.min(target, t + step) : Math.max(target, t - step);
        moving = true;
      }

      const ko = reduced ? 1 : 1 - Math.exp(-dt * 12);
      yaw += (yawGoal - yaw) * ko;
      elev += (elevGoal - elev) * ko;
      if (Math.abs(yawGoal - yaw) > 1e-4 || Math.abs(elevGoal - elev) > 1e-4) moving = true;
      else {
        yaw = yawGoal;
        elev = elevGoal;
      }

      const kc = reduced ? 1 : 1 - Math.exp(-dt * 7);
      for (let k = 0; k < 15; k++) {
        const d = colGoal[k] - col[k];
        if (Math.abs(d) > 0.4) {
          col[k] += d * kc;
          moving = true;
        } else col[k] = colGoal[k];
      }

      const kh = reduced ? 1 : 1 - Math.exp(-dt * 16);
      const kd = reduced ? 1 : 1 - Math.exp(-dt * 10);
      const leg = cfg.current.legendLevel;
      for (let i = 0; i < n; i++) {
        const hg = i === activeIdx ? 1 : 0;
        const dg = leg >= 0 && lv[i] !== leg ? 1 : 0;
        const h = hover[i];
        const d = dim[i];
        if (h !== hg) {
          hover[i] = Math.abs(hg - h) < 0.003 ? hg : h + (hg - h) * kh;
          moving = true;
        }
        if (d !== dg) {
          dim[i] = Math.abs(dg - d) < 0.003 ? dg : d + (dg - d) * kd;
          moving = true;
        }
      }

      draw();
      if (moving) raf = requestAnimationFrame(tick);
    };

    const kick = () => {
      if (raf) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };

    // The active day is the hovered one, else the pinned one (tap, click or keyboard).
    const refreshActive = () => {
      const next = hovered >= 0 ? hovered : pinned;
      if (next === activeIdx) return;
      activeIdx = next;
      cfg.current.setActive(next);
      kick();
    };

    const hit = (x: number, y: number): number => {
      for (let k = n - 1; k >= 0; k--) {
        const i = order[k];
        const o = i * 24;
        if (pointInQuad(polys, o, x, y)) return i;
        if (faces[i] & 1 && pointInQuad(polys, o + 8, x, y)) return i;
        if (faces[i] & 2 && pointInQuad(polys, o + 16, x, y)) return i;
      }
      return -1;
    };

    const local = (ev: PointerEvent | MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      return [ev.clientX - r.left, ev.clientY - r.top] as const;
    };

    let drag: {
      id: number;
      x: number;
      y: number;
      yaw: number;
      elev: number;
      moved: boolean;
      orbit: boolean;
      mouse: boolean;
    } | null = null;

    const onDown = (ev: PointerEvent) => {
      if (ev.button !== 0) return;
      const can = cfg.current.orbit && target === 1;
      drag = {
        id: ev.pointerId,
        x: ev.clientX,
        y: ev.clientY,
        yaw: yawGoal,
        elev: elevGoal,
        moved: false,
        orbit: can,
        mouse: ev.pointerType === "mouse",
      };
      if (can) {
        try {
          canvas.setPointerCapture(ev.pointerId);
        } catch {
          /* capture is a nicety */
        }
      }
    };

    const onMove = (ev: PointerEvent) => {
      if (drag && drag.orbit && ev.pointerId === drag.id) {
        const dx = ev.clientX - drag.x;
        const dyy = ev.clientY - drag.y;
        if (drag.moved || Math.hypot(dx, dyy) > 4) {
          drag.moved = true;
          yawGoal = Math.min(
            YAW_RANGE[1] - YAW_3D,
            Math.max(YAW_RANGE[0] - YAW_3D, drag.yaw + dx * 0.006),
          );
          if (drag.mouse)
            elevGoal = Math.min(
              ELEV_RANGE[1] - ELEV_3D,
              Math.max(ELEV_RANGE[0] - ELEV_3D, drag.elev + dyy * 0.004),
            );
          canvas.style.cursor = "grabbing";
          hovered = -1;
          refreshActive();
          kick();
          return;
        }
      }
      if (ev.pointerType !== "mouse") return;
      const [x, y] = local(ev);
      const i = hit(x, y);
      if (i !== hovered) {
        hovered = i;
        refreshActive();
      }
      canvas.style.cursor =
        cfg.current.orbit && target === 1 ? "grab" : i >= 0 ? "pointer" : "default";
    };

    const onUp = (ev: PointerEvent) => {
      if (!drag || ev.pointerId !== drag.id) return;
      const wasMoved = drag.moved;
      drag = null;
      if (canvas.hasPointerCapture(ev.pointerId)) canvas.releasePointerCapture(ev.pointerId);
      canvas.style.cursor = cfg.current.orbit && target === 1 ? "grab" : "default";
      if (wasMoved) return;
      const [x, y] = local(ev);
      const i = hit(x, y);
      pinned = i === pinned ? -1 : i;
      if (ev.pointerType !== "mouse") hovered = -1;
      refreshActive();
      if (i >= 0) {
        const c = cfg.current.model.cells[i];
        cfg.current.onCellClick?.({ date: c.date, count: c.count });
      }
    };

    const onCancel = () => {
      drag = null;
    };

    const onLeave = () => {
      if (drag) return;
      hovered = -1;
      refreshActive();
    };

    const onDbl = () => {
      yawGoal = 0;
      elevGoal = 0;
      kick();
    };

    const onKey = (ev: KeyboardEvent) => {
      const keys = [
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "Home",
        "End",
        "Escape",
        "Enter",
        " ",
      ];
      if (!keys.includes(ev.key) || !n) return;
      ev.preventDefault();
      if (ev.key === "Escape") {
        pinned = -1;
        hovered = -1;
        refreshActive();
        return;
      }
      let i = pinned >= 0 ? pinned : activeIdx >= 0 ? activeIdx : n - 1;
      if (ev.key === "Enter" || ev.key === " ") {
        const c = cfg.current.model.cells[i];
        cfg.current.onCellClick?.({ date: c.date, count: c.count });
        return;
      }
      if (ev.key === "Home") i = 0;
      else if (ev.key === "End") i = n - 1;
      else if (pinned >= 0 || activeIdx >= 0) {
        if (ev.key === "ArrowLeft") i -= 7;
        if (ev.key === "ArrowRight") i += 7;
        if (ev.key === "ArrowUp") i -= 1;
        if (ev.key === "ArrowDown") i += 1;
      }
      i = Math.max(0, Math.min(n - 1, i));
      pinned = i;
      hovered = -1;
      refreshActive();
      cfg.current.setAnnounce(cfg.current.describe(i));
    };

    const onBlur = () => {
      pinned = -1;
      refreshActive();
    };

    const setTarget = () => {
      const goal = cfg.current.target;
      if (!entered) return;
      if (goal !== target) {
        target = goal;
        if (goal === 0) {
          yawGoal = 0;
          elevGoal = 0;
        }
        canvas.style.cursor = cfg.current.orbit && target === 1 ? "grab" : "default";
        kick();
      }
    };

    load();
    retheme();
    relayout();

    // The 3D view rises out of the flat one the first time it is seen.
    const enter = () => {
      if (entered) return;
      entered = true;
      if (reduced) t = cfg.current.target;
      setTarget();
    };
    let io: IntersectionObserver | null = null;
    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver(
        (entries) => {
          if (entries.some((en) => en.isIntersecting)) {
            enter();
            io?.disconnect();
          }
        },
        { threshold: 0.35 },
      );
      io.observe(stage);
    } else enter();

    const ro = new ResizeObserver(() => {
      if (Math.round(stage.clientWidth) !== W) relayout();
    });
    ro.observe(stage);

    const mo = new MutationObserver(retheme);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style", "data-theme"],
    });
    const onReduce = () => {
      reduced = reduceMq.matches;
      kick();
    };
    reduceMq.addEventListener("change", onReduce);
    darkMq.addEventListener("change", retheme);

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onCancel);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("dblclick", onDbl);
    canvas.addEventListener("keydown", onKey);
    canvas.addEventListener("blur", onBlur);

    engine.current = {
      kick: () => {
        setTarget();
        kick();
      },
      load: () => {
        load();
        retheme();
        relayout();
      },
      retheme,
      tipWidth: (w: number) => {
        tipW = w;
        draw();
      },
    };

    return () => {
      if (raf) cancelAnimationFrame(raf);
      io?.disconnect();
      ro.disconnect();
      mo.disconnect();
      reduceMq.removeEventListener("change", onReduce);
      darkMq.removeEventListener("change", retheme);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onCancel);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("dblclick", onDbl);
      canvas.removeEventListener("keydown", onKey);
      canvas.removeEventListener("blur", onBlur);
      engine.current = null;
    };
    // The loop reads everything else through cfg; it is built once per mount.
  }, [locale]);

  React.useEffect(() => {
    engine.current?.kick();
  }, [view, legendLevel]);

  React.useEffect(() => {
    engine.current?.load();
  }, [model, heightScale]);

  React.useEffect(() => {
    engine.current?.retheme();
  }, [palette]);

  // The tooltip's width is needed to keep it inside the card; measure it when its text changes.
  React.useLayoutEffect(() => {
    const tip = tipRef.current;
    if (tip && active >= 0) engine.current?.tipWidth(tip.offsetWidth);
  }, [active, model]);

  const { stats } = model;
  const range = (a: string | null, b: string | null, withYear = false) => {
    if (!a || !b) return "—";
    const f = withYear ? dfy : df;
    return f.format(dayMs(a)) + " — " + f.format(dayMs(b));
  };
  const is3d = view === "3d";
  const corners = showStats && width >= 560;
  const bigSize = Math.round(Math.max(30, Math.min(56, width * 0.058)));
  const statBlocks = [
    {
      label: "1 year total",
      value: nf.format(stats.total),
      unit: noun(stats.total),
      sub: range(stats.first, stats.last, true),
    },
    {
      label: "Busiest day",
      value: nf.format(stats.busiest.count),
      unit: noun(stats.busiest.count),
      sub: stats.busiest.date ? df.format(dayMs(stats.busiest.date)) : "—",
    },
    {
      label: "Longest streak",
      value: nf.format(stats.longest.days),
      unit: stats.longest.days === 1 ? "day" : "days",
      sub: range(stats.longest.start, stats.longest.end),
    },
    {
      label: "Current streak",
      value: nf.format(stats.current.days),
      unit: stats.current.days === 1 ? "day" : "days",
      sub: range(stats.current.start, stats.current.end),
    },
  ];
  const showRow = showStats && !(is3d && corners);
  const ease = "cubic-bezier(0.65, 0, 0.35, 1)";
  const levelNames = ["No " + plural, "Light", "Moderate", "Heavy", "Heaviest"];

  const hints = [
    "Hover a day for details · arrow keys to explore",
    "Drag to orbit · double-click to reset",
  ];
  const hint = hints[is3d && orbit ? 1 : 0];

  return (
    <section
      ref={rootRef}
      className={
        "relative w-full font-sans " +
        (appearance === "card" ? "rounded-sm border p-4 sm:p-5 " : "") +
        className
      }
      style={{
        background: "hsl(var(--card))",
        color: "hsl(var(--foreground))",
        borderColor: "hsl(var(--border))",
      }}
    >
      <header className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h3 className="m-0 text-[15px] font-normal leading-snug">
          {title ?? (
            <>
              <span className="font-semibold tabular-nums">{nf.format(stats.total)}</span>{" "}
              {noun(stats.total)} in the last year
            </>
          )}
        </h3>
        {showToggle && (
          <div
            role="group"
            aria-label="Chart view"
            className="relative inline-flex rounded-sm border p-0.5"
            style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--muted) / 0.5)" }}
          >
            <span
              aria-hidden="true"
              className="absolute top-0.5 bottom-0.5 left-0.5 w-8 rounded transition-transform duration-500 motion-reduce:transition-none"
              style={{
                background: "hsl(var(--primary) / 0.12)",
                transform: is3d ? "translateX(100%)" : "translateX(0)",
                transitionTimingFunction: ease,
              }}
            />
            {(["2d", "3d"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                aria-label={v === "2d" ? "Flat heat map" : "3D skyline"}
                title={v === "2d" ? "Flat heat map" : "3D skyline"}
                onClick={() => setView(v)}
                className="relative z-10 grid h-7 w-8 cursor-pointer place-items-center rounded border-0 bg-transparent p-0 transition-colors duration-500 focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
                style={{
                  color: view === v ? "hsl(var(--primary))" : MUTED,
                  outlineColor: "hsl(var(--primary))",
                }}
              >
                {v === "2d" ? <GridIcon /> : <CubeIcon />}
              </button>
            ))}
          </div>
        )}
      </header>

      <div
        className={"relative " + (appearance === "card" ? "rounded-sm border" : "")}
        style={{ borderColor: "hsl(var(--border))" }}
      >
        <div className="relative px-3 pt-3 sm:px-4 sm:pt-4">
          <div
            ref={stageRef}
            className="relative w-full overflow-hidden rounded-sm outline-offset-4 has-[:focus-visible]:outline-2"
            style={{ height: 150, outlineColor: "hsl(var(--foreground))" }}
          >
            <canvas
              ref={canvasRef}
              tabIndex={0}
              role="img"
              aria-label={
                nf.format(stats.total) +
                " " +
                noun(stats.total) +
                " between " +
                range(stats.first, stats.last, true) +
                ", shown as a " +
                (is3d ? "3D skyline" : "heat map") +
                ". Use the arrow keys to read individual days."
              }
              className="absolute top-0 left-0 block outline-none"
              style={{ maxWidth: "none", touchAction: is3d && orbit ? "pan-y" : "auto" }}
            />

            {showStats && corners && (
              <>
                <div
                  aria-hidden={!is3d}
                  className="pointer-events-none absolute top-1 right-1 flex flex-col items-end gap-5 transition-[opacity,transform] motion-reduce:transition-none"
                  style={{
                    opacity: is3d ? 1 : 0,
                    transform: is3d ? "translateY(0)" : "translateY(-10px)",
                    transitionDuration: is3d ? "600ms" : "300ms",
                    transitionDelay: is3d ? Math.round(duration * 0.55) + "ms" : "0ms",
                    transitionTimingFunction: ease,
                  }}
                >
                  <Stat {...statBlocks[0]} accent={theme.accent} size={bigSize} align="end" />
                  <Stat {...statBlocks[1]} accent={theme.accent} size={bigSize} align="end" />
                </div>
                <div
                  aria-hidden={!is3d}
                  className="pointer-events-none absolute bottom-1 left-1 flex flex-col items-start gap-5 transition-[opacity,transform] motion-reduce:transition-none"
                  style={{
                    opacity: is3d ? 1 : 0,
                    transform: is3d ? "translateY(0)" : "translateY(10px)",
                    transitionDuration: is3d ? "600ms" : "300ms",
                    transitionDelay: is3d ? Math.round(duration * 0.65) + "ms" : "0ms",
                    transitionTimingFunction: ease,
                  }}
                >
                  <Stat {...statBlocks[2]} accent={theme.accent} size={bigSize} align="start" />
                  <Stat {...statBlocks[3]} accent={theme.accent} size={bigSize} align="start" />
                </div>
              </>
            )}
          </div>

          <div
            ref={tipRef}
            role="tooltip"
            hidden={active < 0}
            aria-hidden={active < 0}
            className="pointer-events-none absolute top-3 left-3 z-20 max-w-[calc(100%_-_1.5rem)] whitespace-normal rounded-md px-2.5 py-1.5 text-[12px] leading-none shadow-lg transition-opacity duration-150 sm:top-4 sm:left-4 motion-reduce:transition-none"
            style={{
              opacity: active >= 0 ? 1 : 0,
              background: "hsl(var(--foreground))",
              color: "hsl(var(--card))",
            }}
          >
            {active >= 0 && model.cells[active] ? (
              <>
                <strong className="font-semibold">
                  {model.cells[active].count
                    ? nf.format(model.cells[active].count) + " " + noun(model.cells[active].count)
                    : "No " + plural}
                </strong>
                <span className="opacity-75">
                  {" "}
                  on {dfy.format(dayMs(model.cells[active].date))}
                </span>
              </>
            ) : (
              " "
            )}
            <span
              aria-hidden="true"
              className="absolute top-full h-0 w-0"
              style={{
                left: "var(--arrow, 50%)",
                marginLeft: -5,
                borderLeft: "5px solid transparent",
                borderRight: "5px solid transparent",
                borderTop: "5px solid hsl(var(--foreground))",
              }}
            />
          </div>
        </div>

        {showStats && (
          <div
            aria-hidden={!showRow}
            className="grid transition-[grid-template-rows,opacity] motion-reduce:transition-none"
            style={{
              gridTemplateRows: showRow ? "1fr" : "0fr",
              opacity: showRow ? 1 : 0,
              transitionDuration: duration + "ms",
              transitionTimingFunction: ease,
            }}
          >
            <div className="min-h-0 overflow-hidden">
              <div className="grid grid-cols-2 gap-x-4 gap-y-4 px-3 pt-4 pb-1 sm:px-4 md:grid-cols-4">
                {statBlocks.map((b) => (
                  <Stat key={b.label} {...b} accent={theme.accent} size={28} align="stack" />
                ))}
              </div>
            </div>
          </div>
        )}

        <div
          className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 pt-3 pb-3 text-[12px] sm:px-4"
          style={{ color: MUTED }}
        >
          {footer === undefined ? (
            <span className="relative grid flex-1">
              {hints.map((h) => (
                <span
                  key={h}
                  aria-hidden={h !== hint}
                  className="[grid-area:1/1] transition-opacity duration-500 motion-reduce:transition-none"
                  style={{ opacity: h === hint ? 1 : 0 }}
                >
                  {h}
                </span>
              ))}
            </span>
          ) : (
            <span className="flex-1">{footer}</span>
          )}
          {showLegend && (
            <div className="flex items-center gap-1.5" onMouseLeave={() => setLegendLevel(-1)}>
              <span className="mr-0.5">Less</span>
              {theme.swatches.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={"Highlight " + levelNames[i].toLowerCase() + " days"}
                  aria-pressed={legendLevel === i}
                  title={levelNames[i]}
                  onMouseEnter={() => setLegendLevel(i)}
                  onFocus={() => setLegendLevel(i)}
                  onBlur={() => setLegendLevel(-1)}
                  onClick={() => setLegendLevel((l) => (l === i ? -1 : i))}
                  className="h-[11px] w-[11px] cursor-pointer rounded-[2px] border-0 p-0 transition-[background-color,transform] duration-500 hover:scale-125 focus-visible:outline-2 focus-visible:outline-offset-1 motion-reduce:transition-none"
                  style={{
                    background: c,
                    outlineColor: "hsl(var(--foreground))",
                    boxShadow: "inset 0 0 0 1px rgba(127,127,127,0.12)",
                  }}
                />
              ))}
              <span className="ml-0.5">More</span>
            </div>
          )}
        </div>
      </div>

      <p aria-live="polite" className="sr-only">
        {announce}
      </p>
    </section>
  );
}
