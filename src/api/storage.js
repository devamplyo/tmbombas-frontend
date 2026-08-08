/**
 * Local persistence (JSON in localStorage).
 * Isolated here so the backend (M2) only needs to replace this layer.
 */
import { seedData, ENTITIES } from './seed';

const PREFIX = 'th_';
const SEED_FLAG = 'th_seeded_v1';

/** Seeds localStorage on first access. */
export function ensureSeeded() {
  if (localStorage.getItem(SEED_FLAG)) return;
  for (const entity of ENTITIES) {
    localStorage.setItem(PREFIX + entity, JSON.stringify(seedData[entity] || []));
  }
  localStorage.setItem(SEED_FLAG, '1');
}

/** Resets everything back to the seed (useful for testing/demos). */
export function resetData() {
  for (const entity of ENTITIES) {
    localStorage.removeItem(PREFIX + entity);
  }
  localStorage.removeItem(SEED_FLAG);
  ensureSeeded();
}

export function readEntity(entity) {
  ensureSeeded();
  try {
    return JSON.parse(localStorage.getItem(PREFIX + entity) || '[]');
  } catch {
    return [];
  }
}

export function writeEntity(entity, rows) {
  localStorage.setItem(PREFIX + entity, JSON.stringify(rows));
}
