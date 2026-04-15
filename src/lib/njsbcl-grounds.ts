import {
  NJSBCL_GROUND_ROWS,
  type NjsbclGroundRow,
} from "./njsbcl-grounds.generated";

export type { NjsbclGroundRow };
export { NJSBCL_GROUND_ROWS };

export type NjsbclGroundMatch = NjsbclGroundRow;

function normalizeKey(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Strip trailing (Sat)/(Sun) etc. from a token. */
function stripDayNote(s: string): string {
  return s.replace(/\s*\([^)]*\)\s*$/g, "").trim();
}

/** Split "Teams sharing ground" cell into tokens (commas or period-space). */
export function parseTeamsSharingCell(cell: string): string[] {
  const parts = cell.split(/,\s*|\.\s+/);
  const out: string[] = [];
  for (const p of parts) {
    const t = stripDayNote(p.trim());
    if (t) out.push(t);
  }
  return out;
}

/**
 * Schedule / app name → token that appears in the Grounds sheet (normalized lookup).
 */
const SCHEDULE_ALIASES: Record<string, string> = {
  [normalizeKey("Adroit CC")]: "adroIT CC",
  [normalizeKey("GoldFinch Cricket Club")]: "Goldfinch CC",
  [normalizeKey("Jersey Knights CC")]: "Jersey Knights CC",
  [normalizeKey("Kallol Of NJ")]: "Kallol of NJ",
  [normalizeKey("Nj Yorkers")]: "NJ Yorkers",
  [normalizeKey("Thunder Strikers CC")]: "Thunder Strikers CC",
};

function buildLookup(): Map<string, NjsbclGroundRow> {
  const m = new Map<string, NjsbclGroundRow>();
  for (const row of NJSBCL_GROUND_ROWS) {
    for (const tok of parseTeamsSharingCell(row.teamsSharing)) {
      m.set(normalizeKey(tok), row);
    }
  }
  return m;
}

const LOOKUP = buildLookup();

/** Town + full "teams sharing" row for a team name from the 2026 schedule workbook. */
export function getNjsbclGroundForTeam(teamName: string): NjsbclGroundMatch | null {
  const alias = SCHEDULE_ALIASES[normalizeKey(teamName)];
  const candidate = alias ?? teamName;
  return LOOKUP.get(normalizeKey(candidate)) ?? LOOKUP.get(normalizeKey(teamName)) ?? null;
}
