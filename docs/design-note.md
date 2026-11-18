# Design note: Steady, a two-minute brain-training game for sustained attention

## 1. The problem, and three rules

**Who it is for.** Steady is built for people at work, offered by their employer as part of a wellbeing programme. Their scarcest resource is not time to train but attention that survives a day of meetings, messages and context switches. So the game has to fit between two meetings, train something they would recognise in their own day, and be safe to offer through an employer: nobody at the company should ever see one person's results.

**What progress may claim.** Players reliably get better at a task they practise, but evidence that brain training carries over to general ability is weak [R] (Simons et al. 2016), and the FTC fined Lumosity $2M in 2016 for claiming otherwise. Popular apps also rank players against each other, while attention moves with sleep, stress and the time of day. So Steady trains one skill, **sustained attention**, shows real improvement at its own task, and compares each player only with their own starting point.

Three rules follow, and every choice below comes back to them:

1. **Measure one thing well, and claim only what the measure supports.**
2. **Compare a player only with themselves.**
3. **Make coming back worthwhile without changing what is measured.**

Rules 1 and 3 pull against each other, and that tension drives most of this note: whatever makes a game more fun can change the measurement. §3 resolves it in the design and then tests the resolution instead of assuming it.

| The brief's question           | What I chose                                                                                                                                     | §      |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| Which game?                    | The SART with thought probes, over Stroop, N-back, task switching, PVT and breath counting                                                       | §2     |
| How does it play?              | A digit on a lantern's glass in a night scene: the lantern-riddle idea, with the theme around the digit, never in it                             | §3     |
| What keeps people coming back? | A loop at three time scales (seconds, minutes, weeks), every reward tied to the player's own play, and a team rewards economy designed for later | §3, §8 |
| How is it scored fairly?       | Four measures computed on the server from raw presses; odd behaviour flagged, never rejected                                                     | §4, §5 |
| How is progress shown?         | "Recent vs. where you started", in words, with ordinary noise shown as "Similar"                                                                 | §6     |

**[R]** marks published research, **[P]** my own product decisions. Exact rules: [`specs/`](../specs/README.md) and `packages/core/src/config.ts`.

## 2. Which game

Beyond rule 1, the task had to be learnable in a minute and timeable in a browser.

| Task              | Measures                                                           | Decision                                              |
| ----------------- | ------------------------------------------------------------------ | ----------------------------------------------------- |
| Stroop            | Inhibitory control                                                 | Conflict between word and colour, not focus over time |
| N-back            | Working memory                                                     | Hard to learn; transfer claims contested              |
| Task switching    | Cognitive flexibility                                              | Strong alternative, left for later (§9)               |
| PVT               | Vigilance, very sensitive to sleep loss [R] (Basner & Dinges 2011) | Little to engage players                              |
| Breath counting   | Mindfulness [R] (Levinson et al. 2014)                             | A browser cannot verify people's own counts           |
| **SART + probes** | **Sustained attention, and where the mind was**                    | **Selected**                                          |

From the apps I took Lumosity's short daily sessions, but not its single performance index shown as a percentile within an age group, and not Elevate's "how you compare with others" (rule 2).

The **Sustained Attention to Response Task** (press for every digit except 3) measures what a workday erodes: minds wandered in 46.9% of experience samples, and wandering went with lower happiness [R] (Killingsworth & Gilbert 2010). Its markers are well studied: RT variability, anticipations and omissions go with disengagement [R] (Cheyne et al. 2009), and higher variability before a thought probe with off-task reports [R] (Bastian & Sackur 2013; Seli et al. 2013b). The probes ("where was your mind just now?") turn a measurement into a moment of reflection. The link holds for groups, not individuals, so Steady offers it as a prompt, never as a detector.

## 3. How it plays, and what brings people back

### From digits to lanterns

The SART's weakness as a game is that it is dull: digits flash on a blank screen, and the right move is mostly to keep pressing. The obvious fix is to theme the stimuli themselves, replacing digits with characters or pictures to spot. But that changes the task: in a gamified go/no-go study, points left the data intact while themed stimuli raised no-go errors by 28% [R] (Lumsden et al. 2016). Theming the thing you react to changes how you react.

The answer came from **lantern riddles** (猜灯谜): at the Chinese Lantern Festival, riddles are written on lanterns, and people walk from lantern to lantern, reading each one and deciding whether to answer. That is the SART's own rhythm, one item at a time and a decision each time, and it puts the theme **around** the item rather than in it. So in Steady [P]:

- **The digit stays the research stimulus,** written on the glass of a lantern in a night scene, at the standard timing.
- **The mask becomes the glass misting over.** It covers the digit's place like the original `⊗`, which play-testers read as "wrong answer" (Spec 006).
- **The lantern answers every press:** it glows after a press and flickers red on a 3, as PsyToolkit's SART 2 turns its mask green. The glow follows the press, so it cannot change its time.
- **The name follows the image:** attention as a light you keep steady through the night.

The task itself stays as researched: a 250 ms digit and a 900 ms mask, in five font sizes [R] (Robertson et al. 1997; PsyToolkit), so results stay comparable with the research and between sessions. Play-tests changed only what makes it learnable [P]: **81 trials and 3 probes** (about two minutes; 126 felt too long, at the cost of noisier error rates than the standard 225 and an unvalidated version), and **practice that starts at an 800 ms digit** and ends at the real speed, because a new player could not keep up at full speed.

### The loop that brings people back

A habit needs a reason to return at every time scale: something during the session, something right after it, and something across the weeks. Each layer gives feedback, a goal or a sense of progress, and each is tied to the player's own play, never to other people (rule 2).

| Time scale                       | Feedback                                                                                       | Goal                                                                            | Sense of progress                                                                                        |
| -------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Seconds** (during the session) | The lantern glows on a press, flickers on a 3                                                  | Game: keep the streak, raise the multiplier (×2 from 5, ×3 from 15, ×5 from 30) | Game: fireflies gather with the streak, and the night sky turns towards dawn                             |
| **Minutes** (right after)        | A one-sentence result, and the whole session as a ribbon of digits with its longest steady run | Game: a new personal best (the highest dawn)                                    | From session 3, today against your earlier sessions; from session 7, against where you started           |
| **Weeks** (across sessions)      | A week of seven lanterns on Home, lit for each day played                                      | **4 of 7 days, not a streak**                                                   | Trends: recent vs. where you started, in words, then charts (§6); game: a gallery of every session's sky |

Two choices in that table carry the most weight:

- **A weekly target, not a daily streak.** A streak turns one missed day into a loss, yet missing one opportunity did not materially affect habit formation over 12 weeks [R] (Lally et al. 2010). And the most informative session is the one on a bad day, which a streak discourages people from playing.
- **No leaderboards.** Ranking colleagues would turn an honest check into a performance, and a shortened task has no norms to rank against.

### Three groups: testing that fun does not change the measure

The lantern design is a bet that the theme can live around the stimulus without moving the results, and the points add a second risk: a visible streak may make people slow down to keep it. Rather than assume, every new player is assigned one of three groups at random, for good (Specs 006, 008, 027):

| Screen                | Plain (control)                    | Calm                                      | Game                                                                    |
| --------------------- | ---------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------- |
| During the trials     | The original: bare digit, `⊗` mask | Lantern in a night scene, glow on a press | As calm, plus points, a multiplier, fireflies and a sky turning to dawn |
| The rest of the check | No scene                           | The night scene                           | The scene at the last session's dawn                                    |
| Home, Results, Trends | Same for all                       | Same for all                              | Also a personal best and a gallery of skies                             |

The digit sequence, timing, probes and scoring never differ, so plain against calm measures the effect of the scene and calm against game the effect of the game layer. Points are game progress, not a measurement: they are derived from the scored trials and never stored, and the personal best is the highest dawn (the share of a session's maximum), not the most points, because an all-correct session's points depend on where the 3s fall.

## 4. Scoring: what counts as a good result

A single score would hide the trade-offs that make SART results meaningful (rule 1), so a session has four measures: **3s held back** (of 9), **digits missed** (of 72), **typical response time** (median RT of correct presses) and **how much the timing varied** (SD ÷ mean). d′ is kept as a secondary measure [R] (Hautus 1995; Stanislaw & Todorov 1999), labelled noisy because it rests on 9 no-go trials.

- **No pass mark.** People typically press on 30–50% of no-go digits and miss 5–10% of go digits [R] (Wilson et al. 2016), so pressing on some 3s is normal, and the rules say so before every session. Those figures come from longer versions, so they are not shown as norms: a good result holds or improves against your own history.
- **Speed and accuracy are always shown together,** because slowing down reduces errors [R] (Seli et al. 2013a).
- **Mistakes and outliers [P]:** presses under 100 ms are anticipations (the PVT's false-start rule); the 1150 ms window bounds the slow end. The first 5 trials and the 3 after each probe count for accuracy but not speed, since slowing after an interruption is not mind-wandering. With fewer than 10 usable RTs, speed is left empty rather than estimated.

## 5. Fair play: mistakes, cheating and trust

A score is fair only if nobody, the player's own browser included, can choose it. That matters more once rewards are attached (§8). So **the server owns the sequence, the clock and the score:** it picks a seed it never sends, stores the exact trials, accepts only raw presses and scores them with one pure function, keeping the raw data so history can be re-scored.

- **Technical problems reject a session:** presses that do not match the trials, impossible timing, or a session older than 30 minutes. Leaving the page voids it.
- **Behaviour is only flagged [P]:** many omissions, many anticipations or machine-like regular timing. Flagged sessions stay in the trends: dropping them would hide the players who are struggling.

The server never calls a session cheating. Browser input cannot be fully trusted; the checks make faking costly, not impossible.

## 6. Showing progress

A list of numbers says what happened, not whether anything changed. Trends answers that in one sentence, for example **"Your last 5 checks: better than where you started at keeping an even rhythm."**

- **Recent vs. where you started [P]:** the median of the last 5 sessions against a fixed starting point, the median of sessions 2–6 (session 1 is practice). Medians, so one odd session cannot swing it.
- **Noise is named [P]:** a change within ordinary session-to-session noise reads "Similar"; one extra 3 held back is not progress.
- **Words first, then charts:** an arrow and a word per measure, then the four charts side by side, so speed and accuracy are read together.
- **Patterns that never overclaim:** sleep and stress splits appear only once two groups have at least 10 sessions, as raw dots with `n`, worded "a pattern so far, not a cause".

## 7. Players, privacy and teams

Each player sees only their own data: a player is a random token, every query is scoped to it, and another player's session is a `404`. For the demo the server also lists every player, so anyone can pick one (Spec 016); making that list private changes one route, not the isolation.

An employer would want to know whether the programme works without seeing anyone's attention scores. The **operator view** gives aggregates only: active players, the share meeting the weekly target, and each measure per group, with at least 10 players per group and no drill-down to a person (OAIC APP 3 and APP 11). It is designed but not built, because it needs real players: [operator-view.md](operator-view.md).

## 8. Beyond the demo: a rewards economy for teams

For an employer, the strongest lever for coming back is not inside the game but around it. I designed, but did not build, a rewards economy:

- **Points for showing up:** each session played, and each week that reaches 4 of 7 days, earns points, with a bonus for consistent weeks.
- **A rewards store:** points are exchanged for prizes the employer funds, from a coffee to an extra wellbeing day.
- **Further on, a digital currency:** points issued as a token that can be held, transferred or spent with partner merchants, so the reward is worth something outside the app.

One rule keeps the economy from breaking the measurement: **rewards follow participation, never performance.** Paying for scores would invite exactly the gaming §5 guards against, would punish people on bad days, and would turn an honest check into a performance (rules 1 and 2). The in-game points of §3 stay what they are, a game layer that buys nothing. Server-owned sessions (§5) and the weekly target (§3) are the foundation it would be built on. It is left out of the demo because its value depends on real teams, real prizes and decisions (budgets, tax, regulation for a token) that belong to the employer.

## 9. Trade-offs and what next

Storing raw presses costs space but makes every result auditable; a two-minute session makes the habit realistic and the numbers noisier, which the noise band answers. With more time: the group comparison of §3 once there are enough players; the rewards economy of §8 with a pilot team; an n-of-1 experiment with a minute of mindful breathing first on random days; an error score corrected for speed; and a task-switching mode. Limitations and technical trade-offs are in the [README](../README.md#assumptions-limitations-and-next-steps).

## Sources

- Robertson, I. H. et al. (1997). 'Oops!': Performance correlates of everyday attentional failures in traumatic brain injured and normal subjects. _Neuropsychologia_, 35(6), 747–758. https://pubmed.ncbi.nlm.nih.gov/9204482/
- PsyToolkit SART implementation (parameters). https://www.psytoolkit.org/experiment-library/sart.html
- PsyToolkit SART 2 (green mask after a correct press). https://www.psytoolkit.org/library/sart2.html
- Lumsden, J., Skinner, A., Woods, A. T., Lawrence, N. S., & Munafò, M. (2016). The effects of gamelike features and test location on cognitive test performance and participant enjoyment. _PeerJ_, 4, e2184. https://doi.org/10.7717/peerj.2184
- Patsenko, E. G. et al. (2019). Mindfulness video game improves connectivity of the fronto-parietal attentional network in adolescents. _Scientific Reports_, 9, 18667. https://doi.org/10.1038/s41598-019-53393-x
- Killingsworth, M. A., & Gilbert, D. T. (2010). A wandering mind is an unhappy mind. _Science_, 330(6006), 932. https://doi.org/10.1126/science.1192439
- Mrazek, M. D., Smallwood, J., & Schooler, J. W. (2012). Mindfulness and mind-wandering: Finding convergence through opposing constructs. _Emotion_. https://doi.org/10.1037/a0026678
- Cheyne, J. A., Solman, G. J. F., Carriere, J. S. A., & Smilek, D. (2009). Anatomy of an error. _Cognition_, 111(1), 98–113. https://doi.org/10.1016/j.cognition.2008.12.009
- Bastian, M., & Sackur, J. (2013). Mind wandering at the fingertips: Automatic parsing of subjective states based on response time variability. _Frontiers in Psychology_, 4. https://doi.org/10.3389/fpsyg.2013.00573
- Seli, P., Cheyne, J. A., & Smilek, D. (2013b). Wandering minds and wavering rhythms: Linking mind wandering and behavioral variability. _JEP: Human Perception and Performance_, 39(1), 1–5. https://doi.org/10.1037/a0030954
- Seli, P., Jonker, T. R., Cheyne, J. A., & Smilek, D. (2013a). Enhancing SART validity by statistically controlling speed-accuracy trade-offs. _Frontiers in Psychology_, 4, 265. https://doi.org/10.3389/fpsyg.2013.00265
- Stanislaw, H., & Todorov, N. (1999). Calculation of signal detection theory measures. _BRMIC_, 31(1), 137–149. https://doi.org/10.3758/BF03207704
- Hautus, M. J. (1995). Corrections for extreme proportions and their biasing effects on estimated values of d′. _BRMIC_, 27(1), 46–51. https://doi.org/10.3758/BF03203619
- Simons, D. J. et al. (2016). Do "brain-training" programs work? _Psychological Science in the Public Interest_, 17(3), 103–186. https://doi.org/10.1177/1529100616661983
- FTC (2016). Lumosity to pay $2 million to settle FTC deceptive advertising charges. https://www.ftc.gov/news-events/news/press-releases/2016/01/lumosity-pay-2-million-settle-ftc-deceptive-advertising-charges-its-brain-training-program
- Basner, M., & Dinges, D. F. (2011). Maximizing sensitivity of the PVT to sleep loss. _Sleep_, 34(5), 581–591. https://pmc.ncbi.nlm.nih.gov/articles/PMC3079937
- Lally, P., van Jaarsveld, C. H. M., Potts, H. W. W., & Wardle, J. (2010). How are habits formed: Modelling habit formation in the real world. _European Journal of Social Psychology_, 40(6), 998–1009. https://doi.org/10.1002/ejsp.674
- Wilson, K. M., Finkbeiner, K. M., de Joux, N. R., Russell, P. N., & Helton, W. S. (2016). Go-stimuli proportion influences response strategy in a sustained attention to response task. _Experimental Brain Research_, 234(10), 2989–2998. https://doi.org/10.1007/s00221-016-4701-x
- Lumosity Help Center. Can I see how I compare to other Lumosity members? https://lumositybeta.zendesk.com/hc/en-us/articles/31133254146199-Can-I-see-how-I-compare-to-other-Lumosity-members
- Elevate app features (The Mind Company). https://themindcompany.com/apps/elevate
- Levinson, D. B. et al. (2014). A mind you can count on: Validating breath counting as a behavioral measure of mindfulness. _Frontiers in Psychology_, 5, 1202. https://doi.org/10.3389/fpsyg.2014.01202
- OAIC. Australian Privacy Principles guidelines (APP 3, APP 11). https://www.oaic.gov.au/privacy/australian-privacy-principles
