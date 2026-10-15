import { motion, useReducedMotion, type Transition } from "framer-motion";

// The Blocks mark, split into the halves the app's full-screen loader animates. Kept in
// step with app-kit's AppLoadingSpinner, which only renders as a fixed overlay.
const topPaths = [
  "M245.455 68.1627V129.877L168.982 156.67V93.9638L245.455 68.1627Z",
  "M240.389 62.3805L165.49 87.6573L5.30933 24.2563L85.3314 0L240.389 62.3805Z",
  "M161.797 93.8295V156.43L81.1141 122.607V188.07L0 152.738V29.6846L161.797 93.8295Z",
];

const bottomPaths = [
  "M76.4728 266.036L0 291.837V230.123L76.4728 203.329V266.036Z",
  "M160.123 360L5.07178 297.619L79.964 272.343L240.145 335.744L160.123 360Z",
  "M245.454 330.315L83.657 266.17V203.57L164.34 237.393V171.93L245.454 207.262V330.315Z",
];

const transition: Transition = {
  duration: 2.4,
  times: [0, 0.3, 0.6, 1],
  ease: ["easeInOut", "easeInOut", "linear"],
  repeat: Infinity,
};

/** The animated Blocks logo, sized to sit inline - in a dialog, card or empty state. */
export const LogoLoader = ({ size = 40, label = "Loading" }: { size?: number; label?: string }) => {
  const reducedMotion = useReducedMotion();
  const offset = 20;
  return (
    <span role="status" className="inline-flex items-center justify-center">
      <span className="sr-only">{label}</span>
      <svg
        width={(size * 246) / 360}
        height={size}
        viewBox="0 0 246 360"
        fill="none"
        className="overflow-visible"
        aria-hidden="true"
        focusable="false"
      >
        <motion.g
          animate={
            reducedMotion ? { x: 0, y: 0 } : { x: [0, -offset, 0, 0], y: [0, -offset, 0, 0] }
          }
          transition={transition}
        >
          {topPaths.map((d) => (
            <path key={d} d={d} className="fill-primary dark:fill-white" />
          ))}
        </motion.g>
        <motion.g
          animate={reducedMotion ? { x: 0, y: 0 } : { x: [0, offset, 0, 0], y: [0, offset, 0, 0] }}
          transition={transition}
        >
          {bottomPaths.map((d) => (
            <path key={d} d={d} className="fill-primary dark:fill-white" />
          ))}
        </motion.g>
      </svg>
    </span>
  );
};
