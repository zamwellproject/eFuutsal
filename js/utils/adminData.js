import { DEFAULT_LINEUP, TEAMS } from '../data/teamsAndPlayers.js';
import { validateLineup } from './validation.js';
import { normalizePlayer } from '../data/playerAttributes.js';
import { defaults, normalizeTeam } from '../core/storage.js';

/** Validate and normalize an imported save without mutating live game data. */
export function validateAdminImport(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Format JSON tidak valid.');
  if (!Array.isArray(raw.players) || !Array.isArray(raw.teams)) throw new Error('Data pemain dan tim wajib tersedia.');
  if (raw.players.length > 200) throw new Error('Maksimal 200 pemain.');

  const teamIds = new Set(TEAMS.map(team => team.id));
  const importedTeamIds = raw.teams.map(team => String(team?.id || ''));
  if (importedTeamIds.length !== teamIds.size || new Set(importedTeamIds).size !== importedTeamIds.length || importedTeamIds.some(id => !teamIds.has(id))) {
    throw new Error('Data harus memuat tepat empat ID tim resmi tanpa duplikasi.');
  }

  const players = raw.players.map((player, index) => {
    if (!player || typeof player !== 'object' || Array.isArray(player)) throw new Error(`Data pemain ke-${index + 1} tidak valid.`);
    if (!String(player.name || '').trim()) throw new Error(`Nama pemain ke-${index + 1} wajib diisi.`);
    if (!Number.isInteger(Number(player.number)) || Number(player.number) < 0 || Number(player.number) > 99) throw new Error(`Nomor pemain ke-${index + 1} harus 0–99.`);
    return normalizePlayer(player);
  });
  if (new Set(players.map(player => player.id)).size !== players.length) throw new Error('ID pemain tidak boleh duplikat.');

  const base = defaults();
  const teams = base.teams.map(team => normalizeTeam(raw.teams.find(item => item.id === team.id), team));
  const lineups = { ...base.lineups };
  if (raw.lineups !== undefined && (!raw.lineups || typeof raw.lineups !== 'object' || Array.isArray(raw.lineups))) throw new Error('Format lineup tidak valid.');
  for (const team of TEAMS) {
    const ids = raw.lineups?.[team.id] ?? DEFAULT_LINEUP;
    const error = validateLineup(ids, players);
    if (error) throw new Error(`Lineup ${team.id}: ${error}`);
    lineups[team.id] = ids.slice();
  }

  const settings = { ...base.settings };
  if (raw.settings && typeof raw.settings === 'object' && !Array.isArray(raw.settings)) {
    settings.music = !!raw.settings.music;
    settings.sfx = raw.settings.sfx !== false;
    settings.volume = Number.isFinite(Number(raw.settings.volume)) ? Math.max(0, Math.min(1, Number(raw.settings.volume))) : base.settings.volume;
    settings.camera = ['broadcast', 'follow', 'top'].includes(raw.settings.camera) ? raw.settings.camera : base.settings.camera;
  }
  const history = Array.isArray(raw.history) ? raw.history.slice(-500) : [];
  return { schema: 1, players, teams, lineups, settings, history };
}
