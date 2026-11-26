import { bengaluruCoffee } from './bengaluruCoffee.js';
import { dubaiHospitality } from './dubaiHospitality.js';
import { londonCoworking } from './londonCoworking.js';

export const MARKETS = [bengaluruCoffee, dubaiHospitality, londonCoworking];

export function getMarketById(id) {
  return MARKETS.find((m) => m.id === id) || MARKETS[0];
}
