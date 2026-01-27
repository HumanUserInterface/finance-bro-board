import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { Persona, PersonaRegistry } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DEFAULTS_DIR = join(__dirname, 'defaults');

function loadPersonaFromFile(filePath: string): Persona {
  const content = readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as Persona;
}

export function loadBuiltInPersonas(): Persona[] {
  const personas: Persona[] = [];

  if (!existsSync(DEFAULTS_DIR)) {
    return personas;
  }

  const files = readdirSync(DEFAULTS_DIR).filter((f) => f.endsWith('.json'));

  for (const file of files) {
    try {
      const persona = loadPersonaFromFile(join(DEFAULTS_DIR, file));
      personas.push(persona);
    } catch (error) {
      console.error(`Failed to load persona from ${file}:`, error);
    }
  }

  return personas;
}

export function loadCustomPersonas(dataDir: string): Persona[] {
  const customDir = join(dataDir, 'custom-personas');
  const personas: Persona[] = [];

  if (!existsSync(customDir)) {
    return personas;
  }

  const files = readdirSync(customDir).filter((f) => f.endsWith('.json'));

  for (const file of files) {
    try {
      const persona = loadPersonaFromFile(join(customDir, file));
      persona.isBuiltIn = false;
      personas.push(persona);
    } catch (error) {
      console.error(`Failed to load custom persona from ${file}:`, error);
    }
  }

  return personas;
}

export function createPersonaRegistry(dataDir: string): PersonaRegistry {
  const builtIn = loadBuiltInPersonas();
  const custom = loadCustomPersonas(dataDir);

  return {
    builtIn,
    custom,
    active: builtIn.map((p) => p.id),
  };
}

export function getPersonaById(registry: PersonaRegistry, id: string): Persona | undefined {
  return registry.builtIn.find((p) => p.id === id) || registry.custom.find((p) => p.id === id);
}

export function getAllPersonas(registry: PersonaRegistry): Persona[] {
  return [...registry.builtIn, ...registry.custom];
}

export function getActivePersonas(registry: PersonaRegistry): Persona[] {
  const all = getAllPersonas(registry);
  return registry.active.map((id) => all.find((p) => p.id === id)).filter((p): p is Persona => p !== undefined);
}
