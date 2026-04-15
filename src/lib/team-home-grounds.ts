import {
  TEAM_HOME_GROUND_ENTRIES,
  type TeamHomeGroundEntry,
} from "./team-home-grounds.generated";

export type { TeamHomeGroundEntry };

export type HomeGround = {
  groundName: string;
  address: string;
};

function normalizeKey(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Fixture / schedule name → exact team string as it appears on NJSBCL (generated list).
 * Only needed when spelling differs; lookup is case-insensitive otherwise.
 */
const SCHEDULE_TO_NJSBCL_TEAM: Record<string, string> = {
  [normalizeKey("Thunder Strikers CC")]: "Thunder Strikers Cricket Club",
  [normalizeKey("Maples SC")]: "Maples Sc",
  [normalizeKey("NJ Champs")]: "Nj Champs",
};

const byNormalizedTeam = new Map<string, HomeGround>();
for (const e of TEAM_HOME_GROUND_ENTRIES) {
  byNormalizedTeam.set(normalizeKey(e.team), {
    groundName: e.groundName,
    address: e.address,
  });
}

/** Home ground scraped from NJSBCL team list (name + address). */
export function getHomeGroundForTeam(teamName: string): HomeGround | null {
  const n = normalizeKey(teamName);
  const canonical = SCHEDULE_TO_NJSBCL_TEAM[n] ?? teamName;
  return byNormalizedTeam.get(normalizeKey(canonical)) ?? null;
}
