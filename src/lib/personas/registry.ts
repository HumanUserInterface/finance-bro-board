import type { Persona, PersonaRegistry } from './types';

// Import all built-in personas
import chadAlpha from './defaults/chad-alpha.json';
import frugalFrank from './defaults/frugal-frank.json';
import warrenBoomer from './defaults/warren-boomer.json';
import cryptoKyle from './defaults/crypto-kyle.json';
import dividendDave from './defaults/dividend-dave.json';
import indexIrene from './defaults/index-irene.json';
import yoloYolanda from './defaults/yolo-yolanda.json';
import debtFreeDerek from './defaults/debt-free-derek.json';
import minimalistMaya from './defaults/minimalist-maya.json';
import sideHustleSam from './defaults/side-hustle-sam.json';
import insuranceIrma from './defaults/insurance-irma.json';
import sustainableSophie from './defaults/sustainable-sophie.json';
import dataDrivenDan from './defaults/data-driven-dan.json';
import healthFirstHannah from './defaults/health-first-hannah.json';
import generationalGary from './defaults/generational-gary.json';
import treatYourselfTara from './defaults/treat-yourself-tara.json';
import comparisonCarl from './defaults/comparison-carl.json';

const builtInPersonas: Persona[] = [
  chadAlpha as Persona,
  frugalFrank as Persona,
  warrenBoomer as Persona,
  cryptoKyle as Persona,
  dividendDave as Persona,
  indexIrene as Persona,
  yoloYolanda as Persona,
  debtFreeDerek as Persona,
  minimalistMaya as Persona,
  sideHustleSam as Persona,
  insuranceIrma as Persona,
  sustainableSophie as Persona,
  dataDrivenDan as Persona,
  healthFirstHannah as Persona,
  generationalGary as Persona,
  treatYourselfTara as Persona,
  comparisonCarl as Persona,
];

export function getBuiltInPersonas(): Persona[] {
  return builtInPersonas;
}

export function createPersonaRegistry(customPersonas: Persona[] = []): PersonaRegistry {
  return {
    builtIn: builtInPersonas,
    custom: customPersonas,
    active: builtInPersonas.map((p) => p.id),
  };
}

export function getPersonaById(id: string): Persona | undefined {
  return builtInPersonas.find((p) => p.id === id);
}

export function getAllPersonas(registry: PersonaRegistry): Persona[] {
  return [...registry.builtIn, ...registry.custom];
}

export function getActivePersonas(registry: PersonaRegistry): Persona[] {
  const all = getAllPersonas(registry);
  return registry.active
    .map((id) => all.find((p) => p.id === id))
    .filter((p): p is Persona => p !== undefined);
}
