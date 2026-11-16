# Operator view (designed, not built)

Part of the [design note](design-note.md) (§7).

A team running Steady, or an employer offering it, would want to know whether people use it and what patterns appear across players. I designed this view but did not build it: the brief is about each player's own progress, a local demo has too few players for aggregates to mean anything, and charts drawn from invented data would break the design note's rule (§6) that nothing is drawn from too little data.

- **What it shows [P]:** engagement (active players per week, the share meeting the weekly target, the share who come back after session 1) and, per group, the spread of each metric with its `n`.
- **Groups:** time of day, day of week, input device and check-in answers. Never a single player.
- **One value per player [P]:** each player contributes their median to a group, so a few heavy users cannot dominate it.
- **Access:** operators sign in separately (SSO), and `/admin` routes have their own guard. A player token gets `403`, so the deny-by-default player API is unchanged.
- **Privacy [P]:** aggregates only. A group with fewer than **10 players** is not shown (the design note's §6 threshold, counted in players rather than sessions). No drill-down to a player and no per-player export. An employer sees only its own organisation (APP 3, APP 11).
- **Comparability:** within one input device and one `scoringVersion`; practice sessions excluded; flagged sessions included and counted, as in design note §5.
- **What it needs first:** each session's local time zone (today only the browser knows it, which is why the weekly target is computed on the client), and an organisation model for employers.

Wireframe (illustrative numbers; a player can appear in several groups):

```
+------------------------------------------------------------------+
| Steady - Operator view           Organisation: Acme v  4 weeks v |
+------------------------------------------------------------------+
|  Active players     Met weekly target     Came back after #1     |
|       48                  31%                    72%             |
+------------------------------------------------------------------+
|  Metric: Catch rate v   Group by: Time of day v   Keyboard v     |
|                                                                  |
|  Morning    n = 21 players   |----[====|===]----|   median 79%   |
|  Afternoon  n = 17 players   |--[===|====]------|   median 74%   |
|  Evening    n = 6 players    Not shown: fewer than 10 players    |
|                                                                  |
|  One value per player (their median). A pattern, not a cause.    |
|  Scoring v2 - keyboard only - practice sessions excluded         |
+------------------------------------------------------------------+
```
