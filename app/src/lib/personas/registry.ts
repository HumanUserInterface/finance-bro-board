import type { Persona } from './types';

import warrenBoomer from './defaults/warren-boomer.json';
import frugalFrank from './defaults/frugal-frank.json';
import indexIrene from './defaults/index-irene.json';
import cryptoKyle from './defaults/crypto-kyle.json';
import yoloYolanda from './defaults/yolo-yolanda.json';
import debtFreeDerek from './defaults/debt-free-derek.json';
import minimalistMaya from './defaults/minimalist-maya.json';

// The 7 core personas for deliberation
export const personas: Persona[] = [
  warrenBoomer as Persona,
  frugalFrank as Persona,
  indexIrene as Persona,
  cryptoKyle as Persona,
  yoloYolanda as Persona,
  debtFreeDerek as Persona,
  minimalistMaya as Persona,
];

export function getPersonas(): Persona[] {
  return personas;
}

export function getPersonaById(id: string): Persona | undefined {
  return personas.find((p) => p.id === id);
}

export function getPersonaByName(name: string): Persona | undefined {
  return personas.find((p) => p.name.toLowerCase() === name.toLowerCase());
}
