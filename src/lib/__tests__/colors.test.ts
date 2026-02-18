import { describe, it, expect } from 'vitest';
import { trustToRgb, trustToHex, trustToTextColor, rgbToHex } from '../colors';

describe('trustToRgb', () => {
  it('returns white for unclassified (trust < 0)', () => {
    expect(trustToRgb(-1)).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('returns red for trust=0', () => {
    expect(trustToRgb(0)).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('returns yellow for trust=0.5', () => {
    expect(trustToRgb(0.5)).toEqual({ r: 255, g: 255, b: 0 });
  });

  it('returns blue for trust=1.0', () => {
    expect(trustToRgb(1.0)).toEqual({ r: 0, g: 0, b: 255 });
  });

  it('interpolates in the 0-0.5 range (red to yellow)', () => {
    const rgb = trustToRgb(0.25);
    expect(rgb.r).toBe(255);
    expect(rgb.g).toBe(128); // Math.round(510 * 0.25) = 128
    expect(rgb.b).toBe(0);
  });
});

describe('trustToHex', () => {
  it('returns valid hex strings', () => {
    expect(trustToHex(-1)).toMatch(/^#[0-9a-f]{6}$/);
    expect(trustToHex(0)).toMatch(/^#[0-9a-f]{6}$/);
    expect(trustToHex(0.5)).toMatch(/^#[0-9a-f]{6}$/);
    expect(trustToHex(1.0)).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('maps known values', () => {
    expect(trustToHex(-1)).toBe('#ffffff');
    expect(trustToHex(0)).toBe('#ff0000');
    expect(trustToHex(1.0)).toBe('#0000ff');
  });
});

describe('rgbToHex', () => {
  it('clamps values to 0-255', () => {
    expect(rgbToHex({ r: -10, g: 300, b: 128 })).toBe('#00ff80');
  });
});

describe('trustToTextColor', () => {
  it('returns black for unclassified', () => {
    expect(trustToTextColor(-1)).toBe('#000000');
  });

  it('returns black for trust=0', () => {
    expect(trustToTextColor(0)).toBe('#000000');
  });

  it('returns white for low trust (0 < t < 0.3)', () => {
    expect(trustToTextColor(0.1)).toBe('#FFFFFF');
    expect(trustToTextColor(0.2)).toBe('#FFFFFF');
  });

  it('returns black for mid trust (0.3 <= t <= 0.8)', () => {
    expect(trustToTextColor(0.3)).toBe('#000000');
    expect(trustToTextColor(0.5)).toBe('#000000');
    expect(trustToTextColor(0.8)).toBe('#000000');
  });

  it('returns white for high trust (> 0.8)', () => {
    expect(trustToTextColor(0.81)).toBe('#FFFFFF');
    expect(trustToTextColor(1.0)).toBe('#FFFFFF');
  });
});
