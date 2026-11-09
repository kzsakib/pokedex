/* Win chance: run the same battle engine 200 times with different seeds and
   report how often the player comes out on top. The loop yields to the event
   loop every few simulations so the loading panel keeps painting. */

import { runBattle } from "./gen1Battle.js";

export async function estimateWinChance(
  playerTeam,
  enemyTeam,
  { sims = 200, multipliers = {}, baseSeed = 7, onProgress } = {},
) {
  if (!playerTeam?.length || !enemyTeam?.length) return 0;

  let wins = 0;

  for (let index = 0; index < sims; index += 1) {
    const result = runBattle(playerTeam, enemyTeam, {
      seed: baseSeed * 7919 + index + 1,
      multipliers,
    });
    if (result.winner === "player") wins += 1;

    if (index % 8 === 7) {
      onProgress?.(index + 1, sims);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
    }
  }

  onProgress?.(sims, sims);
  return Math.round((wins / sims) * 100);
}
