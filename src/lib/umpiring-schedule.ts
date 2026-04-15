/**
 * Div-2 schedule rows (TSV: Week, Date, Div-2-A, Div-2-D, Home Team, Umpiring).
 * Umpiring tab lists rows where the designated umpiring side is Garden State 11 or
 * Garden State Tigers (same club / shared division umpiring in the source sheet).
 */

export type Div2ScheduleRow = {
  week: number;
  date: string;
  div2a: string;
  div2d: string;
  homeTeam: string;
  umpiringTeam: string;
};

function parseLine(line: string): Div2ScheduleRow | null {
  const p = line.split("\t");
  if (p.length < 6) return null;
  const week = Number.parseInt(p[0]!, 10);
  if (!Number.isFinite(week)) return null;
  return {
    week,
    date: p[1]!,
    div2a: p[2]!,
    div2d: p[3]!,
    homeTeam: p[4]!,
    umpiringTeam: p[5]!,
  };
}

/** Stable key for a schedule row (assignments, API validation). */
export function div2MatchKey(r: Div2ScheduleRow): string {
  return [
    r.week,
    r.date,
    r.div2a,
    r.div2d,
    r.homeTeam,
    r.umpiringTeam,
  ].join("|");
}

const RAW_TSV = `Week	Date	Div-2-A	Div-2-D	Home Team	Umpiring
1	Saturday, April 18, 2026	Lion King	Parsippany Sports Cricket XI	Lion King	Jersey Knights CC
1	Saturday, April 18, 2026	Toms River XI	Jersey Colts	Toms River XI	Blue Leaf SC
1	Saturday, April 18, 2026	The Knights	NJ Champs	The Knights	Bengal Express
1	Saturday, April 18, 2026	Thunder Strikers CC	Jersey Panthers	Thunder Strikers CC	Gymkhana CC
1	Saturday, April 18, 2026	Jersey Indians	Adroit CC	Jersey Indians	NJ Yorkers
1	Saturday, April 18, 2026	Garden State 11	Yuva	Garden State 11	Patriots CC
1	Saturday, April 18, 2026	Renegades	Jersey Spartans	Renegades	Gujarat Titans
1	Saturday, April 18, 2026	Cedar Falcons	Galli CC	Cedar Falcons	Super Kings
1	Saturday, April 18, 2026	Smashers XI	Tough Boys	Smashers XI	Edison Hawks CC
1	Saturday, April 18, 2026	Friends XI	Ridge Cricket Club	Friends XI	Blue Warriors
1	Sunday, April 19, 2026	11 Hunters	Sreeshti Aggies	Sreeshti Aggies	The Elites
1	Sunday, April 19, 2026	Maples SC	Plainsboro Hawks	Plainsboro Hawks	SCC XI
1	Sunday, April 19, 2026	Maywood Indians	Manalapan Cricket Club	Manalapan Cricket Club	Kranti XI
1	Sunday, April 19, 2026	Jersey Vikings	Giants	Giants	Kinnelon Colts
1	Sunday, April 19, 2026	Kennedy Kings	Jersey Lions	Jersey Lions	Robbinsville CC
1	Sunday, April 19, 2026	Plainsboro Super Kings	Piscataway Mavericks	Piscataway Mavericks	The Isotopes
1	Sunday, April 19, 2026	Piscataway Warriors	Supernovas	Supernovas	Manhattan Tigers
1	Sunday, April 19, 2026	22 Yards	Crimson Hawks	Crimson Hawks	Somerset CC
1	Sunday, April 19, 2026	Royal Strikers	Secaucus Punters	Secaucus Punters	Bergen Warriors
1	Sunday, April 19, 2026	Gilli	Starz CC	Starz CC	Renaissance Kings
2	Saturday, April 25, 2026	11 Hunters	Plainsboro Hawks	11 Hunters	Namo XI
2	Saturday, April 25, 2026	Maples SC	Manalapan Cricket Club	Maples SC	Bergen Boys
2	Saturday, April 25, 2026	Maywood Indians	Giants	Maywood Indians	Orion Stars
2	Saturday, April 25, 2026	Jersey Vikings	Jersey Lions	Jersey Vikings	Sunrisers CC
2	Saturday, April 25, 2026	Kennedy Kings	Piscataway Mavericks	Kennedy Kings	107ers
2	Saturday, April 25, 2026	Plainsboro Super Kings	Supernovas	Plainsboro Super Kings	Marlboro CC
2	Saturday, April 25, 2026	Piscataway Warriors	Crimson Hawks	Piscataway Warriors	Panthers
2	Saturday, April 25, 2026	22 Yards	Secaucus Punters	22 Yards	Newport Nukes
2	Saturday, April 25, 2026	Royal Strikers	Starz CC	Royal Strikers	Jersey Stallions
2	Saturday, April 25, 2026	Gilli	Sreeshti Aggies	Gilli	Kallol Of NJ
2	Sunday, April 26, 2026	Lion King	Jersey Colts	Jersey Colts	Knoll CC
2	Sunday, April 26, 2026	Toms River XI	NJ Champs	NJ Champs	Chargerz
2	Sunday, April 26, 2026	The Knights	Jersey Panthers	Jersey Panthers	Super Challengers
2	Sunday, April 26, 2026	Thunder Strikers CC	Adroit CC	Adroit CC	PCC
2	Sunday, April 26, 2026	Jersey Indians	Yuva	Yuva	Montgomery Knights CC
2	Sunday, April 26, 2026	Garden State 11	Jersey Spartans	Jersey Spartans	Straight Drive CC
2	Sunday, April 26, 2026	Renegades	Galli CC	Galli CC	Bisons XI
2	Sunday, April 26, 2026	Cedar Falcons	Tough Boys	Tough Boys	NJ Smashers
2	Sunday, April 26, 2026	Smashers XI	Ridge Cricket Club	Ridge Cricket Club	CCE Warriors
2	Sunday, April 26, 2026	Friends XI	Parsippany Sports Cricket XI	Parsippany Sports Cricket XI	Garden State 11
3	Saturday, May 02, 2026	Lion King	NJ Champs	Lion King	Blue Leaf SC
3	Saturday, May 02, 2026	Toms River XI	Jersey Panthers	Toms River XI	Bengal Express
3	Saturday, May 02, 2026	The Knights	Adroit CC	The Knights	Gymkhana CC
3	Saturday, May 02, 2026	Thunder Strikers CC	Yuva	Thunder Strikers CC	NJ Yorkers
3	Saturday, May 02, 2026	Jersey Indians	Jersey Spartans	Jersey Indians	Patriots CC
3	Saturday, May 02, 2026	Garden State 11	Galli CC	Garden State 11	Gujarat Titans
3	Saturday, May 02, 2026	Renegades	Tough Boys	Renegades	Super Kings
3	Saturday, May 02, 2026	Cedar Falcons	Ridge Cricket Club	Cedar Falcons	Edison Hawks CC
3	Saturday, May 02, 2026	Smashers XI	Parsippany Sports Cricket XI	Smashers XI	Blue Warriors
3	Saturday, May 02, 2026	Friends XI	Jersey Colts	Friends XI	Jersey Knights CC
3	Sunday, May 03, 2026	11 Hunters	Manalapan Cricket Club	Manalapan Cricket Club	SCC XI
3	Sunday, May 03, 2026	Maples SC	Giants	Giants	Kranti XI
3	Sunday, May 03, 2026	Maywood Indians	Jersey Lions	Jersey Lions	Kinnelon Colts
3	Sunday, May 03, 2026	Jersey Vikings	Piscataway Mavericks	Piscataway Mavericks	Robbinsville CC
3	Sunday, May 03, 2026	Kennedy Kings	Supernovas	Supernovas	The Isotopes
3	Sunday, May 03, 2026	Plainsboro Super Kings	Crimson Hawks	Crimson Hawks	Manhattan Tigers
3	Sunday, May 03, 2026	Piscataway Warriors	Secaucus Punters	Secaucus Punters	Somerset CC
3	Sunday, May 03, 2026	22 Yards	Starz CC	Starz CC	Bergen Warriors
3	Sunday, May 03, 2026	Royal Strikers	Sreeshti Aggies	Sreeshti Aggies	Renaissance Kings
3	Sunday, May 03, 2026	Gilli	Plainsboro Hawks	Plainsboro Hawks	The Elites
4	Saturday, May 09, 2026	11 Hunters	Giants	11 Hunters	Bergen Boys
4	Saturday, May 09, 2026	Maples SC	Jersey Lions	Maples SC	Orion Stars
4	Saturday, May 09, 2026	Maywood Indians	Piscataway Mavericks	Maywood Indians	Sunrisers CC
4	Saturday, May 09, 2026	Jersey Vikings	Supernovas	Jersey Vikings	107ers
4	Saturday, May 09, 2026	Kennedy Kings	Crimson Hawks	Kennedy Kings	Marlboro CC
4	Saturday, May 09, 2026	Plainsboro Super Kings	Secaucus Punters	Plainsboro Super Kings	Panthers
4	Saturday, May 09, 2026	Piscataway Warriors	Starz CC	Piscataway Warriors	Newport Nukes
4	Saturday, May 09, 2026	22 Yards	Sreeshti Aggies	22 Yards	Jersey Stallions
4	Saturday, May 09, 2026	Royal Strikers	Plainsboro Hawks	Royal Strikers	Kallol Of NJ
4	Saturday, May 09, 2026	Gilli	Manalapan Cricket Club	Gilli	Namo XI
4	Sunday, May 10, 2026	Lion King	Jersey Panthers	Jersey Panthers	Chargerz
4	Sunday, May 10, 2026	Toms River XI	Adroit CC	Adroit CC	Super Challengers
4	Sunday, May 10, 2026	The Knights	Yuva	Yuva	PCC
4	Sunday, May 10, 2026	Thunder Strikers CC	Jersey Spartans	Jersey Spartans	Montgomery Knights CC
4	Sunday, May 10, 2026	Jersey Indians	Galli CC	Galli CC	Straight Drive CC
4	Sunday, May 10, 2026	Garden State 11	Tough Boys	Tough Boys	Bisons XI
4	Sunday, May 10, 2026	Renegades	Ridge Cricket Club	Ridge Cricket Club	NJ Smashers
4	Sunday, May 10, 2026	Cedar Falcons	Parsippany Sports Cricket XI	Parsippany Sports Cricket XI	Garden State 11
4	Sunday, May 10, 2026	Smashers XI	Jersey Colts	Jersey Colts	Garden State Tigers
4	Sunday, May 10, 2026	Friends XI	NJ Champs	NJ Champs	Knoll CC
5	Saturday, May 16, 2026	Lion King	Adroit CC	Lion King	Bengal Express
5	Saturday, May 16, 2026	Toms River XI	Yuva	Toms River XI	Gymkhana CC
5	Saturday, May 16, 2026	The Knights	Jersey Spartans	The Knights	NJ Yorkers
5	Saturday, May 16, 2026	Thunder Strikers CC	Galli CC	Thunder Strikers CC	Patriots CC
5	Saturday, May 16, 2026	Jersey Indians	Tough Boys	Jersey Indians	Gujarat Titans
5	Saturday, May 16, 2026	Garden State 11	Ridge Cricket Club	Garden State 11	Super Kings
5	Saturday, May 16, 2026	Renegades	Parsippany Sports Cricket XI	Renegades	Edison Hawks CC
5	Saturday, May 16, 2026	Cedar Falcons	Jersey Colts	Cedar Falcons	Blue Warriors
5	Saturday, May 16, 2026	Smashers XI	NJ Champs	Smashers XI	Jersey Knights CC
5	Saturday, May 16, 2026	Friends XI	Jersey Panthers	Friends XI	Blue Leaf SC
5	Sunday, May 17, 2026	11 Hunters	Jersey Lions	Jersey Lions	Kranti XI
5	Sunday, May 17, 2026	Maples SC	Piscataway Mavericks	Piscataway Mavericks	Kinnelon Colts
5	Sunday, May 17, 2026	Maywood Indians	Supernovas	Supernovas	Robbinsville CC
5	Sunday, May 17, 2026	Jersey Vikings	Crimson Hawks	Crimson Hawks	The Isotopes
5	Sunday, May 17, 2026	Kennedy Kings	Secaucus Punters	Secaucus Punters	Manhattan Tigers
5	Sunday, May 17, 2026	Plainsboro Super Kings	Starz CC	Starz CC	Somerset CC
5	Sunday, May 17, 2026	Piscataway Warriors	Sreeshti Aggies	Sreeshti Aggies	Bergen Warriors
5	Sunday, May 17, 2026	22 Yards	Plainsboro Hawks	Plainsboro Hawks	Renaissance Kings
5	Sunday, May 17, 2026	Royal Strikers	Manalapan Cricket Club	Manalapan Cricket Club	The Elites
5	Sunday, May 17, 2026	Gilli	Giants	Giants	SCC XI
6	Saturday, May 30, 2026	11 Hunters	Piscataway Mavericks	11 Hunters	Orion Stars
6	Saturday, May 30, 2026	Maples SC	Supernovas	Maples SC	Sunrisers CC
6	Saturday, May 30, 2026	Maywood Indians	Crimson Hawks	Maywood Indians	107ers
6	Saturday, May 30, 2026	Jersey Vikings	Secaucus Punters	Jersey Vikings	Marlboro CC
6	Saturday, May 30, 2026	Kennedy Kings	Starz CC	Kennedy Kings	Panthers
6	Saturday, May 30, 2026	Plainsboro Super Kings	Sreeshti Aggies	Plainsboro Super Kings	Newport Nukes
6	Saturday, May 30, 2026	Piscataway Warriors	Plainsboro Hawks	Piscataway Warriors	Jersey Stallions
6	Saturday, May 30, 2026	22 Yards	Manalapan Cricket Club	22 Yards	Kallol Of NJ
6	Saturday, May 30, 2026	Royal Strikers	Giants	Royal Strikers	Namo XI
6	Saturday, May 30, 2026	Gilli	Jersey Lions	Gilli	Bergen Boys
6	Sunday, May 31, 2026	Lion King	Yuva	Yuva	Super Challengers
6	Sunday, May 31, 2026	Toms River XI	Jersey Spartans	Jersey Spartans	PCC
6	Sunday, May 31, 2026	The Knights	Galli CC	Galli CC	Montgomery Knights CC
6	Sunday, May 31, 2026	Thunder Strikers CC	Tough Boys	Tough Boys	Straight Drive CC
6	Sunday, May 31, 2026	Jersey Indians	Ridge Cricket Club	Ridge Cricket Club	Bisons XI
6	Sunday, May 31, 2026	Garden State 11	Parsippany Sports Cricket XI	Parsippany Sports Cricket XI	NJ Smashers
6	Sunday, May 31, 2026	Renegades	Jersey Colts	Jersey Colts	CCE Warriors
6	Sunday, May 31, 2026	Cedar Falcons	NJ Champs	NJ Champs	Garden State Tigers
6	Sunday, May 31, 2026	Smashers XI	Jersey Panthers	Jersey Panthers	Knoll CC
6	Sunday, May 31, 2026	Friends XI	Adroit CC	Adroit CC	Chargerz
7	Saturday, June 06, 2026	Lion King	Jersey Spartans	Lion King	Gymkhana CC
7	Saturday, June 06, 2026	Toms River XI	Galli CC	Toms River XI	NJ Yorkers
7	Saturday, June 06, 2026	The Knights	Tough Boys	The Knights	Patriots CC
7	Saturday, June 06, 2026	Thunder Strikers CC	Ridge Cricket Club	Thunder Strikers CC	Gujarat Titans
7	Saturday, June 06, 2026	Jersey Indians	Parsippany Sports Cricket XI	Jersey Indians	Super Kings
7	Saturday, June 06, 2026	Garden State 11	Jersey Colts	Garden State 11	Edison Hawks CC
7	Saturday, June 06, 2026	Renegades	NJ Champs	Renegades	Blue Warriors
7	Saturday, June 06, 2026	Cedar Falcons	Jersey Panthers	Cedar Falcons	Jersey Knights CC
7	Saturday, June 06, 2026	Smashers XI	Adroit CC	Smashers XI	Blue Leaf SC
7	Saturday, June 06, 2026	Friends XI	Yuva	Friends XI	Bengal Express
7	Sunday, June 07, 2026	11 Hunters	Supernovas	Supernovas	Kinnelon Colts
7	Sunday, June 07, 2026	Maples SC	Crimson Hawks	Crimson Hawks	Robbinsville CC
7	Sunday, June 07, 2026	Maywood Indians	Secaucus Punters	Secaucus Punters	The Isotopes
7	Sunday, June 07, 2026	Jersey Vikings	Starz CC	Starz CC	Manhattan Tigers
7	Sunday, June 07, 2026	Kennedy Kings	Sreeshti Aggies	Sreeshti Aggies	Somerset CC
7	Sunday, June 07, 2026	Plainsboro Super Kings	Plainsboro Hawks	Plainsboro Hawks	Bergen Warriors
7	Sunday, June 07, 2026	Piscataway Warriors	Manalapan Cricket Club	Manalapan Cricket Club	Renaissance Kings
7	Sunday, June 07, 2026	22 Yards	Giants	Giants	The Elites
7	Sunday, June 07, 2026	Royal Strikers	Jersey Lions	Jersey Lions	SCC XI
7	Sunday, June 07, 2026	Gilli	Piscataway Mavericks	Piscataway Mavericks	Kranti XI
8	Saturday, June 13, 2026	11 Hunters	Crimson Hawks	11 Hunters	Sunrisers CC
8	Saturday, June 13, 2026	Maples SC	Secaucus Punters	Maples SC	107ers
8	Saturday, June 13, 2026	Maywood Indians	Starz CC	Maywood Indians	Marlboro CC
8	Saturday, June 13, 2026	Jersey Vikings	Sreeshti Aggies	Jersey Vikings	Panthers
8	Saturday, June 13, 2026	Kennedy Kings	Plainsboro Hawks	Kennedy Kings	Newport Nukes
8	Saturday, June 13, 2026	Plainsboro Super Kings	Manalapan Cricket Club	Plainsboro Super Kings	Jersey Stallions
8	Saturday, June 13, 2026	Piscataway Warriors	Giants	Piscataway Warriors	Kallol Of NJ
8	Saturday, June 13, 2026	22 Yards	Jersey Lions	22 Yards	Namo XI
8	Saturday, June 13, 2026	Royal Strikers	Piscataway Mavericks	Royal Strikers	Bergen Boys
8	Saturday, June 13, 2026	Gilli	Supernovas	Gilli	Orion Stars
8	Sunday, June 14, 2026	Lion King	Galli CC	Galli CC	PCC
8	Sunday, June 14, 2026	Toms River XI	Tough Boys	Tough Boys	Montgomery Knights CC
8	Sunday, June 14, 2026	The Knights	Ridge Cricket Club	Ridge Cricket Club	Straight Drive CC
8	Sunday, June 14, 2026	Thunder Strikers CC	Parsippany Sports Cricket XI	Parsippany Sports Cricket XI	Bisons XI
8	Sunday, June 14, 2026	Jersey Indians	Jersey Colts	Jersey Colts	NJ Smashers
8	Sunday, June 14, 2026	Garden State 11	NJ Champs	NJ Champs	CCE Warriors
8	Sunday, June 14, 2026	Renegades	Jersey Panthers	Jersey Panthers	Garden State Tigers
8	Sunday, June 14, 2026	Cedar Falcons	Adroit CC	Adroit CC	Knoll CC
8	Sunday, June 14, 2026	Smashers XI	Yuva	Yuva	Chargerz
8	Sunday, June 14, 2026	Friends XI	Jersey Spartans	Jersey Spartans	Super Challengers
9	Saturday, June 20, 2026	Lion King	Tough Boys	Lion King	NJ Yorkers
9	Saturday, June 20, 2026	Toms River XI	Ridge Cricket Club	Toms River XI	Patriots CC
9	Saturday, June 20, 2026	The Knights	Parsippany Sports Cricket XI	The Knights	Gujarat Titans
9	Saturday, June 20, 2026	Thunder Strikers CC	Jersey Colts	Thunder Strikers CC	Super Kings
9	Saturday, June 20, 2026	Jersey Indians	NJ Champs	Jersey Indians	Edison Hawks CC
9	Saturday, June 20, 2026	Garden State 11	Jersey Panthers	Garden State 11	Blue Warriors
9	Saturday, June 20, 2026	Renegades	Adroit CC	Renegades	Jersey Knights CC
9	Saturday, June 20, 2026	Cedar Falcons	Yuva	Cedar Falcons	Blue Leaf SC
9	Saturday, June 20, 2026	Smashers XI	Jersey Spartans	Smashers XI	Bengal Express
9	Saturday, June 20, 2026	Friends XI	Galli CC	Friends XI	Gymkhana CC
9	Sunday, June 21, 2026	11 Hunters	Secaucus Punters	Secaucus Punters	Robbinsville CC
9	Sunday, June 21, 2026	Maples SC	Starz CC	Starz CC	The Isotopes
9	Sunday, June 21, 2026	Maywood Indians	Sreeshti Aggies	Sreeshti Aggies	Manhattan Tigers
9	Sunday, June 21, 2026	Jersey Vikings	Plainsboro Hawks	Plainsboro Hawks	Somerset CC
9	Sunday, June 21, 2026	Kennedy Kings	Manalapan Cricket Club	Manalapan Cricket Club	Bergen Warriors
9	Sunday, June 21, 2026	Plainsboro Super Kings	Giants	Giants	Renaissance Kings
9	Sunday, June 21, 2026	Piscataway Warriors	Jersey Lions	Jersey Lions	The Elites
9	Sunday, June 21, 2026	22 Yards	Piscataway Mavericks	Piscataway Mavericks	SCC XI
9	Sunday, June 21, 2026	Royal Strikers	Supernovas	Supernovas	Kranti XI
9	Sunday, June 21, 2026	Gilli	Crimson Hawks	Crimson Hawks	Kinnelon Colts
10	Saturday, June 27, 2026	11 Hunters	Starz CC	11 Hunters	107ers
10	Saturday, June 27, 2026	Maples SC	Sreeshti Aggies	Maples SC	Marlboro CC
10	Saturday, June 27, 2026	Maywood Indians	Plainsboro Hawks	Maywood Indians	Panthers
10	Saturday, June 27, 2026	Jersey Vikings	Manalapan Cricket Club	Jersey Vikings	Newport Nukes
10	Saturday, June 27, 2026	Kennedy Kings	Giants	Kennedy Kings	Jersey Stallions
10	Saturday, June 27, 2026	Plainsboro Super Kings	Jersey Lions	Plainsboro Super Kings	Kallol Of NJ
10	Saturday, June 27, 2026	Piscataway Warriors	Piscataway Mavericks	Piscataway Warriors	Namo XI
10	Saturday, June 27, 2026	22 Yards	Supernovas	22 Yards	Bergen Boys
10	Saturday, June 27, 2026	Royal Strikers	Crimson Hawks	Royal Strikers	Orion Stars
10	Saturday, June 27, 2026	Gilli	Secaucus Punters	Gilli	Sunrisers CC
10	Sunday, June 28, 2026	Lion King	Ridge Cricket Club	Ridge Cricket Club	Montgomery Knights CC
10	Sunday, June 28, 2026	Toms River XI	Parsippany Sports Cricket XI	Parsippany Sports Cricket XI	Straight Drive CC
10	Sunday, June 28, 2026	The Knights	Jersey Colts	Jersey Colts	Bisons XI
10	Sunday, June 28, 2026	Thunder Strikers CC	NJ Champs	NJ Champs	NJ Smashers
10	Sunday, June 28, 2026	Jersey Indians	Jersey Panthers	Jersey Panthers	CCE Warriors
10	Sunday, June 28, 2026	Garden State 11	Adroit CC	Adroit CC	Garden State Tigers
10	Sunday, June 28, 2026	Renegades	Yuva	Yuva	Knoll CC
10	Sunday, June 28, 2026	Cedar Falcons	Jersey Spartans	Jersey Spartans	Chargerz
10	Sunday, June 28, 2026	Smashers XI	Galli CC	Galli CC	Super Challengers
10	Sunday, June 28, 2026	Friends XI	Tough Boys	Tough Boys	PCC
11	Saturday, July 11, 2026	11 Hunters	Ridge Cricket Club	11 Hunters	Blue Warriors
11	Saturday, July 11, 2026	Maples SC	Tough Boys	Maples SC	Edison Hawks CC
11	Saturday, July 11, 2026	Maywood Indians	Galli CC	Maywood Indians	Super Kings
11	Saturday, July 11, 2026	Jersey Vikings	Jersey Spartans	Jersey Vikings	Gujarat Titans
11	Saturday, July 11, 2026	Kennedy Kings	Yuva	Kennedy Kings	Patriots CC
11	Saturday, July 11, 2026	Plainsboro Super Kings	Adroit CC	Plainsboro Super Kings	NJ Yorkers
11	Saturday, July 11, 2026	Piscataway Warriors	Jersey Panthers	Piscataway Warriors	Gymkhana CC
11	Saturday, July 11, 2026	22 Yards	NJ Champs	22 Yards	Bengal Express
11	Saturday, July 11, 2026	Royal Strikers	Jersey Colts	Royal Strikers	Blue Leaf SC
11	Saturday, July 11, 2026	Gilli	Parsippany Sports Cricket XI	Gilli	Jersey Knights CC
11	Sunday, July 12, 2026	Lion King	Starz CC	Starz CC	Knoll CC
11	Sunday, July 12, 2026	Toms River XI	Secaucus Punters	Secaucus Punters	Chargerz
11	Sunday, July 12, 2026	The Knights	Crimson Hawks	Crimson Hawks	Super Challengers
11	Sunday, July 12, 2026	Thunder Strikers CC	Supernovas	Supernovas	PCC
11	Sunday, July 12, 2026	Jersey Indians	Piscataway Mavericks	Piscataway Mavericks	Montgomery Knights CC
11	Sunday, July 12, 2026	Garden State 11	Jersey Lions	Jersey Lions	Straight Drive CC
11	Sunday, July 12, 2026	Renegades	Giants	Giants	Bisons XI
11	Sunday, July 12, 2026	Cedar Falcons	Manalapan Cricket Club	Manalapan Cricket Club	NJ Smashers
11	Sunday, July 12, 2026	Smashers XI	Plainsboro Hawks	Plainsboro Hawks	CCE Warriors
11	Sunday, July 12, 2026	Friends XI	Sreeshti Aggies	Sreeshti Aggies	Garden State 11
12	Saturday, July 18, 2026	Lion King	Secaucus Punters	Lion King	Bergen Boys
12	Saturday, July 18, 2026	Toms River XI	Crimson Hawks	Toms River XI	Namo XI
12	Saturday, July 18, 2026	The Knights	Supernovas	The Knights	Kallol Of NJ
12	Saturday, July 18, 2026	Thunder Strikers CC	Piscataway Mavericks	Thunder Strikers CC	Jersey Stallions
12	Saturday, July 18, 2026	Jersey Indians	Jersey Lions	Jersey Indians	Newport Nukes
12	Saturday, July 18, 2026	Garden State 11	Giants	Garden State 11	Panthers
12	Saturday, July 18, 2026	Renegades	Manalapan Cricket Club	Renegades	Marlboro CC
12	Saturday, July 18, 2026	Cedar Falcons	Plainsboro Hawks	Cedar Falcons	107ers
12	Saturday, July 18, 2026	Smashers XI	Sreeshti Aggies	Smashers XI	Sunrisers CC
12	Saturday, July 18, 2026	Friends XI	Starz CC	Friends XI	Orion Stars
12	Sunday, July 19, 2026	11 Hunters	Tough Boys	Tough Boys	The Elites
12	Sunday, July 19, 2026	Maples SC	Galli CC	Galli CC	SCC XI
12	Sunday, July 19, 2026	Maywood Indians	Jersey Spartans	Jersey Spartans	Kranti XI
12	Sunday, July 19, 2026	Jersey Vikings	Yuva	Yuva	Kinnelon Colts
12	Sunday, July 19, 2026	Kennedy Kings	Adroit CC	Adroit CC	Robbinsville CC
12	Sunday, July 19, 2026	Plainsboro Super Kings	Jersey Panthers	Jersey Panthers	The Isotopes
12	Sunday, July 19, 2026	Piscataway Warriors	NJ Champs	NJ Champs	Manhattan Tigers
12	Sunday, July 19, 2026	22 Yards	Jersey Colts	Jersey Colts	Somerset CC
12	Sunday, July 19, 2026	Royal Strikers	Parsippany Sports Cricket XI	Parsippany Sports Cricket XI	Bergen Warriors
12	Sunday, July 19, 2026	Gilli	Ridge Cricket Club	Ridge Cricket Club	Renaissance Kings
13	Saturday, July 25, 2026	11 Hunters	Galli CC	11 Hunters	Edison Hawks CC
13	Saturday, July 25, 2026	Maples SC	Jersey Spartans	Maples SC	Super Kings
13	Saturday, July 25, 2026	Maywood Indians	Yuva	Maywood Indians	Gujarat Titans
13	Saturday, July 25, 2026	Jersey Vikings	Adroit CC	Jersey Vikings	Patriots CC
13	Saturday, July 25, 2026	Kennedy Kings	Jersey Panthers	Kennedy Kings	NJ Yorkers
13	Saturday, July 25, 2026	Plainsboro Super Kings	NJ Champs	Plainsboro Super Kings	Gymkhana CC
13	Saturday, July 25, 2026	Piscataway Warriors	Jersey Colts	Piscataway Warriors	Bengal Express
13	Saturday, July 25, 2026	22 Yards	Parsippany Sports Cricket XI	22 Yards	Blue Leaf SC
13	Saturday, July 25, 2026	Royal Strikers	Ridge Cricket Club	Royal Strikers	Jersey Knights CC
13	Saturday, July 25, 2026	Gilli	Tough Boys	Gilli	Blue Warriors
13	Sunday, July 26, 2026	Lion King	Crimson Hawks	Crimson Hawks	Chargerz
13	Sunday, July 26, 2026	Toms River XI	Supernovas	Supernovas	Super Challengers
13	Sunday, July 26, 2026	The Knights	Piscataway Mavericks	Piscataway Mavericks	PCC
13	Sunday, July 26, 2026	Thunder Strikers CC	Jersey Lions	Jersey Lions	Montgomery Knights CC
13	Sunday, July 26, 2026	Jersey Indians	Giants	Giants	Straight Drive CC
13	Sunday, July 26, 2026	Garden State 11	Manalapan Cricket Club	Manalapan Cricket Club	Bisons XI
13	Sunday, July 26, 2026	Renegades	Plainsboro Hawks	Plainsboro Hawks	NJ Smashers
13	Sunday, July 26, 2026	Cedar Falcons	Sreeshti Aggies	Sreeshti Aggies	CCE Warriors
13	Sunday, July 26, 2026	Smashers XI	Starz CC	Starz CC	Garden State Tigers
13	Sunday, July 26, 2026	Friends XI	Secaucus Punters	Secaucus Punters	Garden State 11
14	Saturday, August 01, 2026	Lion King	Supernovas	Lion King	Namo XI
14	Saturday, August 01, 2026	Toms River XI	Piscataway Mavericks	Toms River XI	Kallol Of NJ
14	Saturday, August 01, 2026	The Knights	Jersey Lions	The Knights	Jersey Stallions
14	Saturday, August 01, 2026	Thunder Strikers CC	Giants	Thunder Strikers CC	Newport Nukes
14	Saturday, August 01, 2026	Jersey Indians	Manalapan Cricket Club	Jersey Indians	Panthers
14	Saturday, August 01, 2026	Garden State 11	Plainsboro Hawks	Garden State 11	Marlboro CC
14	Saturday, August 01, 2026	Renegades	Sreeshti Aggies	Renegades	107ers
14	Saturday, August 01, 2026	Cedar Falcons	Starz CC	Cedar Falcons	Sunrisers CC
14	Saturday, August 01, 2026	Smashers XI	Secaucus Punters	Smashers XI	Orion Stars
14	Saturday, August 01, 2026	Friends XI	Crimson Hawks	Friends XI	Bergen Boys
14	Sunday, August 02, 2026	11 Hunters	Jersey Spartans	Jersey Spartans	SCC XI
14	Sunday, August 02, 2026	Maples SC	Yuva	Yuva	Kranti XI
14	Sunday, August 02, 2026	Maywood Indians	Adroit CC	Adroit CC	Kinnelon Colts
14	Sunday, August 02, 2026	Jersey Vikings	Jersey Panthers	Jersey Panthers	Robbinsville CC
14	Sunday, August 02, 2026	Kennedy Kings	NJ Champs	NJ Champs	The Isotopes
14	Sunday, August 02, 2026	Plainsboro Super Kings	Jersey Colts	Jersey Colts	Manhattan Tigers
14	Sunday, August 02, 2026	Piscataway Warriors	Parsippany Sports Cricket XI	Parsippany Sports Cricket XI	Somerset CC
14	Sunday, August 02, 2026	22 Yards	Ridge Cricket Club	Ridge Cricket Club	Bergen Warriors
14	Sunday, August 02, 2026	Royal Strikers	Tough Boys	Tough Boys	Renaissance Kings
14	Sunday, August 02, 2026	Gilli	Galli CC	Galli CC	The Elites
15	Saturday, August 08, 2026	11 Hunters	Yuva	11 Hunters	Super Kings
15	Saturday, August 08, 2026	Maples SC	Adroit CC	Maples SC	Gujarat Titans
15	Saturday, August 08, 2026	Maywood Indians	Jersey Panthers	Maywood Indians	Patriots CC
15	Saturday, August 08, 2026	Jersey Vikings	NJ Champs	Jersey Vikings	NJ Yorkers
15	Saturday, August 08, 2026	Kennedy Kings	Jersey Colts	Kennedy Kings	Gymkhana CC
15	Saturday, August 08, 2026	Plainsboro Super Kings	Parsippany Sports Cricket XI	Plainsboro Super Kings	Bengal Express
15	Saturday, August 08, 2026	Piscataway Warriors	Ridge Cricket Club	Piscataway Warriors	Blue Leaf SC
15	Saturday, August 08, 2026	22 Yards	Tough Boys	22 Yards	Jersey Knights CC
15	Saturday, August 08, 2026	Royal Strikers	Galli CC	Royal Strikers	Blue Warriors
15	Saturday, August 08, 2026	Gilli	Jersey Spartans	Gilli	Edison Hawks CC
15	Sunday, August 09, 2026	Lion King	Piscataway Mavericks	Piscataway Mavericks	Super Challengers
15	Sunday, August 09, 2026	Toms River XI	Jersey Lions	Jersey Lions	PCC
15	Sunday, August 09, 2026	The Knights	Giants	Giants	Montgomery Knights CC
15	Sunday, August 09, 2026	Thunder Strikers CC	Manalapan Cricket Club	Manalapan Cricket Club	Straight Drive CC
15	Sunday, August 09, 2026	Jersey Indians	Plainsboro Hawks	Plainsboro Hawks	Bisons XI
15	Sunday, August 09, 2026	Garden State 11	Sreeshti Aggies	Sreeshti Aggies	NJ Smashers
15	Sunday, August 09, 2026	Renegades	Starz CC	Starz CC	CCE Warriors
15	Sunday, August 09, 2026	Cedar Falcons	Secaucus Punters	Secaucus Punters	Garden State Tigers
15	Sunday, August 09, 2026	Smashers XI	Crimson Hawks	Crimson Hawks	Knoll CC
15	Sunday, August 09, 2026	Friends XI	Supernovas	Supernovas	Chargerz
16	Saturday, August 15, 2026	Lion King	Jersey Lions	Lion King	Kallol Of NJ
16	Saturday, August 15, 2026	Toms River XI	Giants	Toms River XI	Jersey Stallions
16	Saturday, August 15, 2026	The Knights	Manalapan Cricket Club	The Knights	Newport Nukes
16	Saturday, August 15, 2026	Thunder Strikers CC	Plainsboro Hawks	Thunder Strikers CC	Panthers
16	Saturday, August 15, 2026	Jersey Indians	Sreeshti Aggies	Jersey Indians	Marlboro CC
16	Saturday, August 15, 2026	Garden State 11	Starz CC	Garden State 11	107ers
16	Saturday, August 15, 2026	Renegades	Secaucus Punters	Renegades	Sunrisers CC
16	Saturday, August 15, 2026	Cedar Falcons	Crimson Hawks	Cedar Falcons	Orion Stars
16	Saturday, August 15, 2026	Smashers XI	Supernovas	Smashers XI	Bergen Boys
16	Saturday, August 15, 2026	Friends XI	Piscataway Mavericks	Friends XI	Namo XI
16	Sunday, August 16, 2026	11 Hunters	Adroit CC	Adroit CC	Kranti XI
16	Sunday, August 16, 2026	Maples SC	Jersey Panthers	Jersey Panthers	Kinnelon Colts
16	Sunday, August 16, 2026	Maywood Indians	NJ Champs	NJ Champs	Robbinsville CC
16	Sunday, August 16, 2026	Jersey Vikings	Jersey Colts	Jersey Colts	The Isotopes
16	Sunday, August 16, 2026	Kennedy Kings	Parsippany Sports Cricket XI	Parsippany Sports Cricket XI	Manhattan Tigers
16	Sunday, August 16, 2026	Plainsboro Super Kings	Ridge Cricket Club	Ridge Cricket Club	Somerset CC
16	Sunday, August 16, 2026	Piscataway Warriors	Tough Boys	Tough Boys	Bergen Warriors
16	Sunday, August 16, 2026	22 Yards	Galli CC	Galli CC	Renaissance Kings
16	Sunday, August 16, 2026	Royal Strikers	Jersey Spartans	Jersey Spartans	The Elites
16	Sunday, August 16, 2026	Gilli	Yuva	Yuva	SCC XI
17	Saturday, August 22, 2026	11 Hunters	Jersey Panthers	11 Hunters	Gujarat Titans
17	Saturday, August 22, 2026	Maples SC	NJ Champs	Maples SC	Patriots CC
17	Saturday, August 22, 2026	Maywood Indians	Jersey Colts	Maywood Indians	NJ Yorkers
17	Saturday, August 22, 2026	Jersey Vikings	Parsippany Sports Cricket XI	Jersey Vikings	Gymkhana CC
17	Saturday, August 22, 2026	Kennedy Kings	Ridge Cricket Club	Kennedy Kings	Bengal Express
17	Saturday, August 22, 2026	Plainsboro Super Kings	Tough Boys	Plainsboro Super Kings	Blue Leaf SC
17	Saturday, August 22, 2026	Piscataway Warriors	Galli CC	Piscataway Warriors	Jersey Knights CC
17	Saturday, August 22, 2026	22 Yards	Jersey Spartans	22 Yards	Blue Warriors
17	Saturday, August 22, 2026	Royal Strikers	Yuva	Royal Strikers	Edison Hawks CC
17	Saturday, August 22, 2026	Gilli	Adroit CC	Gilli	Super Kings
17	Sunday, August 23, 2026	Lion King	Giants	Giants	PCC
17	Sunday, August 23, 2026	Toms River XI	Manalapan Cricket Club	Manalapan Cricket Club	Montgomery Knights CC
17	Sunday, August 23, 2026	The Knights	Plainsboro Hawks	Plainsboro Hawks	Straight Drive CC
17	Sunday, August 23, 2026	Thunder Strikers CC	Sreeshti Aggies	Sreeshti Aggies	Bisons XI
17	Sunday, August 23, 2026	Jersey Indians	Starz CC	Starz CC	NJ Smashers
17	Sunday, August 23, 2026	Garden State 11	Secaucus Punters	Secaucus Punters	CCE Warriors
17	Sunday, August 23, 2026	Renegades	Crimson Hawks	Crimson Hawks	Garden State Tigers
17	Sunday, August 23, 2026	Cedar Falcons	Supernovas	Supernovas	Knoll CC
17	Sunday, August 23, 2026	Smashers XI	Piscataway Mavericks	Piscataway Mavericks	Chargerz
17	Sunday, August 23, 2026	Friends XI	Jersey Lions	Jersey Lions	Super Challengers
18	Saturday, August 29, 2026	Lion King	Manalapan Cricket Club	Lion King	Jersey Stallions
18	Saturday, August 29, 2026	Toms River XI	Plainsboro Hawks	Toms River XI	Newport Nukes
18	Saturday, August 29, 2026	The Knights	Sreeshti Aggies	The Knights	Panthers
18	Saturday, August 29, 2026	Thunder Strikers CC	Starz CC	Thunder Strikers CC	Marlboro CC
18	Saturday, August 29, 2026	Jersey Indians	Secaucus Punters	Jersey Indians	107ers
18	Saturday, August 29, 2026	Garden State 11	Crimson Hawks	Garden State 11	Sunrisers CC
18	Saturday, August 29, 2026	Renegades	Supernovas	Renegades	Orion Stars
18	Saturday, August 29, 2026	Cedar Falcons	Piscataway Mavericks	Cedar Falcons	Bergen Boys
18	Saturday, August 29, 2026	Smashers XI	Jersey Lions	Smashers XI	Namo XI
18	Saturday, August 29, 2026	Friends XI	Giants	Friends XI	Kallol Of NJ
18	Sunday, August 30, 2026	11 Hunters	NJ Champs	NJ Champs	Kinnelon Colts
18	Sunday, August 30, 2026	Maples SC	Jersey Colts	Jersey Colts	Robbinsville CC
18	Sunday, August 30, 2026	Maywood Indians	Parsippany Sports Cricket XI	Parsippany Sports Cricket XI	The Isotopes
18	Sunday, August 30, 2026	Jersey Vikings	Ridge Cricket Club	Ridge Cricket Club	Manhattan Tigers
18	Sunday, August 30, 2026	Kennedy Kings	Tough Boys	Tough Boys	Somerset CC
18	Sunday, August 30, 2026	Plainsboro Super Kings	Galli CC	Galli CC	Bergen Warriors
18	Sunday, August 30, 2026	Piscataway Warriors	Jersey Spartans	Jersey Spartans	Renaissance Kings
18	Sunday, August 30, 2026	22 Yards	Yuva	Yuva	The Elites
18	Sunday, August 30, 2026	Royal Strikers	Adroit CC	Adroit CC	SCC XI
18	Sunday, August 30, 2026	Gilli	Jersey Panthers	Jersey Panthers	Kranti XI
19	Saturday, September 12, 2026	11 Hunters	Jersey Colts	11 Hunters	Patriots CC
19	Saturday, September 12, 2026	Maples SC	Parsippany Sports Cricket XI	Maples SC	NJ Yorkers
19	Saturday, September 12, 2026	Maywood Indians	Ridge Cricket Club	Maywood Indians	Gymkhana CC
19	Saturday, September 12, 2026	Jersey Vikings	Tough Boys	Jersey Vikings	Bengal Express
19	Saturday, September 12, 2026	Kennedy Kings	Galli CC	Kennedy Kings	Blue Leaf SC
19	Saturday, September 12, 2026	Plainsboro Super Kings	Jersey Spartans	Plainsboro Super Kings	Jersey Knights CC
19	Saturday, September 12, 2026	Piscataway Warriors	Yuva	Piscataway Warriors	Blue Warriors
19	Saturday, September 12, 2026	22 Yards	Adroit CC	22 Yards	Edison Hawks CC
19	Saturday, September 12, 2026	Royal Strikers	Jersey Panthers	Royal Strikers	Super Kings
19	Saturday, September 12, 2026	Gilli	NJ Champs	Gilli	Gujarat Titans
19	Sunday, September 13, 2026	Lion King	Plainsboro Hawks	Plainsboro Hawks	Montgomery Knights CC
19	Sunday, September 13, 2026	Toms River XI	Sreeshti Aggies	Sreeshti Aggies	Straight Drive CC
19	Sunday, September 13, 2026	The Knights	Starz CC	Starz CC	Bisons XI
19	Sunday, September 13, 2026	Thunder Strikers CC	Secaucus Punters	Secaucus Punters	NJ Smashers
19	Sunday, September 13, 2026	Jersey Indians	Crimson Hawks	Crimson Hawks	CCE Warriors
19	Sunday, September 13, 2026	Garden State 11	Supernovas	Supernovas	Garden State Tigers
19	Sunday, September 13, 2026	Renegades	Piscataway Mavericks	Piscataway Mavericks	Knoll CC
19	Sunday, September 13, 2026	Cedar Falcons	Jersey Lions	Jersey Lions	Chargerz
19	Sunday, September 13, 2026	Smashers XI	Giants	Giants	Super Challengers
19	Sunday, September 13, 2026	Friends XI	Manalapan Cricket Club	Manalapan Cricket Club	PCC
20	Saturday, September 19, 2026	Lion King	Sreeshti Aggies	Lion King	Newport Nukes
20	Saturday, September 19, 2026	Toms River XI	Starz CC	Toms River XI	Panthers
20	Saturday, September 19, 2026	The Knights	Secaucus Punters	The Knights	Marlboro CC
20	Saturday, September 19, 2026	Thunder Strikers CC	Crimson Hawks	Thunder Strikers CC	107ers
20	Saturday, September 19, 2026	Jersey Indians	Supernovas	Jersey Indians	Sunrisers CC
20	Saturday, September 19, 2026	Garden State 11	Piscataway Mavericks	Garden State 11	Orion Stars
20	Saturday, September 19, 2026	Renegades	Jersey Lions	Renegades	Bergen Boys
20	Saturday, September 19, 2026	Cedar Falcons	Giants	Cedar Falcons	Namo XI
20	Saturday, September 19, 2026	Smashers XI	Manalapan Cricket Club	Smashers XI	Kallol Of NJ
20	Saturday, September 19, 2026	Friends XI	Plainsboro Hawks	Friends XI	Jersey Stallions
20	Sunday, September 20, 2026	11 Hunters	Parsippany Sports Cricket XI	Parsippany Sports Cricket XI	Robbinsville CC
20	Sunday, September 20, 2026	Maples SC	Ridge Cricket Club	Ridge Cricket Club	The Isotopes
20	Sunday, September 20, 2026	Maywood Indians	Tough Boys	Tough Boys	Manhattan Tigers
20	Sunday, September 20, 2026	Jersey Vikings	Galli CC	Galli CC	Somerset CC
20	Sunday, September 20, 2026	Kennedy Kings	Jersey Spartans	Jersey Spartans	Bergen Warriors
20	Sunday, September 20, 2026	Plainsboro Super Kings	Yuva	Yuva	Renaissance Kings
20	Sunday, September 20, 2026	Piscataway Warriors	Adroit CC	Adroit CC	The Elites
20	Sunday, September 20, 2026	22 Yards	Jersey Panthers	Jersey Panthers	SCC XI
20	Sunday, September 20, 2026	Royal Strikers	NJ Champs	NJ Champs	Kranti XI
20	Sunday, September 20, 2026	Gilli	Jersey Colts	Jersey Colts	Kinnelon Colts`;

const _lines = RAW_TSV.trim().split("\n");
const _header = _lines[0]!.split("\t");
if (_header[0] !== "Week") {
  throw new Error("div2 schedule: bad header");
}

export const DIV2_FULL_SCHEDULE: Div2ScheduleRow[] = _lines
  .slice(1)
  .map((line) => parseLine(line))
  .filter((r): r is Div2ScheduleRow => r != null);

const CLUB_UMPIRING_TEAMS = new Set(["Garden State 11", "Garden State Tigers"]);

export function gardenState11UmpiringMatches(): Div2ScheduleRow[] {
  return DIV2_FULL_SCHEDULE.filter((r) =>
    CLUB_UMPIRING_TEAMS.has(r.umpiringTeam),
  );
}

/** Match keys allowed for umpiring assignment writes (server + client). */
export function clubUmpiringMatchKeySet(): Set<string> {
  return new Set(gardenState11UmpiringMatches().map(div2MatchKey));
}
