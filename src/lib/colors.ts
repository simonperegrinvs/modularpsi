/**
 * Trust → RGB color conversion.
 * Ported from legacy/mpsilib/utils.cpp:20-42
 *
 * trust < 0    → white (unclassified)
 * 0.0 – 0.5    → red(255,0,0) → yellow(255,255,0)
 * 0.5 – 1.0    → yellow → blue(0,0,255)
 */
export function trustToRgb(trust: number): { r: number; g: number; b: number } {
  if (trust < 0) {
    return { r: 255, g: 255, b: 255 };
  }
  if (trust < 0.5) {
    return {
      r: 255,
      g: Math.round(510 * trust),
      b: 0,
    };
  }
  return {
    r: Math.round(510 * (1 - trust)),
    g: Math.round(510 * (1 - trust)),
    b: Math.round(510 * (trust - 0.5)),
  };
}

/** Convert RGB object to CSS hex string */
export function rgbToHex({ r, g, b }: { r: number; g: number; b: number }): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Trust value → CSS hex color */
export function trustToHex(trust: number): string {
  return rgbToHex(trustToRgb(trust));
}

/**
 * Determine text color based on trust level.
 * From legacy node.cpp:82-85: white text when trust > 0.8 or 0 < trust < 0.3
 */
export function trustToTextColor(trust: number): string {
  if (trust > 0.8 || (trust > 0 && trust < 0.3)) {
    return '#FFFFFF';
  }
  return '#000000';
}
