import { homedir } from 'os';
import { resolve } from 'path';

export const DEFAULT_VAULT = '~/data/modularpsi';

export function resolveVaultPath(rawPath?: string): string {
  const pathValue = rawPath?.trim() || DEFAULT_VAULT;
  if (pathValue === '~') return homedir();
  if (pathValue.startsWith('~/')) {
    return resolve(homedir(), pathValue.slice(2));
  }
  return resolve(pathValue);
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function compactTimestamp(): string {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, 'Z');
}

