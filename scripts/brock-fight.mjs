#!/usr/bin/env node
/* Milestone 1 smoke test: resolve a Brock fight and print the full log.
   Usage: node scripts/brock-fight.mjs [seed] */
import { logBrockFight } from "../src/gauntlet/brockFight.js";

const seed = Number(process.argv[2] ?? 1337);
logBrockFight(Number.isFinite(seed) ? seed : 1337);
