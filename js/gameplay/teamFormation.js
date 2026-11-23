// Tactical 1-2-1 futsal shape. attackSign identifies the team's defending end:
// +1 defends +Z and attacks -Z; -1 is the mirror image.
export const FORMATIONS = [
  { role: 'Anchor', x: 0, z: 5.2 },
  { role: 'Pivot', x: 0, z: -7.0 },
  { role: 'Flank Kanan', x: 5.2, z: -2.0 },
  { role: 'Flank Kiri', x: -5.2, z: -2.0 },
  { role: 'Goalkeeper', x: 0, z: 15.8 }
];
export function formationTarget(slot, attackSign = 1) {
  const p = FORMATIONS[slot] || FORMATIONS[0];
  return { x: p.x, z: p.z * attackSign };
}
