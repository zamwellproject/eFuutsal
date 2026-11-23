export const RESTARTS = Object.freeze({
  KICKOFF: 'KICK-OFF', KICKIN: 'KICK-IN', GOALKICK: 'GOAL CLEARANCE',
  CORNER: 'CORNER KICK', FREEKICK: 'FREE KICK', PENALTY: 'PENALTY'
});
export function classifyOut(lastTouchTeam, ball, defendingTeamAtEnd) {
  if (Math.abs(ball.x) >= 9.55) return { type: 'KICKIN', team: 1 - lastTouchTeam };
  if (Math.abs(ball.z) >= 17.55) {
    if (lastTouchTeam === defendingTeamAtEnd) return { type: 'CORNER', team: 1 - defendingTeamAtEnd };
    return { type: 'GOALKICK', team: defendingTeamAtEnd };
  }
  return null;
}
export function registerFoul(fouls, team, half) {
  if (!Array.isArray(fouls) || (team !== 0 && team !== 1)) throw new TypeError('Invalid foul team');
  fouls[team] = Math.max(0, Math.min(99, (fouls[team] || 0) + 1));
  return { team, count: fouls[team], secondPenalty: fouls[team] >= 5, half };
}
export function resetHalfFouls() { return [0, 0]; }
