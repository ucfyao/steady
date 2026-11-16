# Design Note — Steady: a three-minute daily focus check

## 1. The idea

Steady is a calm attention game built on the **Sustained Attention to Response Task (SART)**, with brief **thought probes** that ask "where was your mind just now?". It shows how accurate, fast and steady your attention was today, compared with your own history, next to an optional sleep and stress check-in. It does not promise to make you smarter.

**[R]** marks claims from published research; **[P]** marks my own product decisions. The exact rules are in `specs/` and `packages/core/src/config.ts`.

## 2. What I looked at

| Task              | Why considered                                                     | Decision                                                       |
| ----------------- | ------------------------------------------------------------------ | -------------------------------------------------------------- |
| Stroop            | Inhibitory control; simple interaction                             | Measures conflict between word and colour, not focus over time |
| N-back            | Working memory                                                     | Hard to learn; transfer claims contested                       |
| Task switching    | Cognitive flexibility; fits a workday full of interruptions        | Strong alternative                                             |
| PVT               | Vigilance; very sensitive to sleep loss [R] (Basner & Dinges 2011) | Little to engage players                                       |
| Breath counting   | Validated measure of mindfulness [R] (Levinson et al. 2014)        | A browser cannot verify people's own counts                    |
| **SART + probes** | **Sustained attention plus self-reflection**                       | **Selected**                                                   |

| App      | What it does                                                                                                                  | What I took or avoided                                                          |
| -------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Lumosity | Many short games; a performance index (LPI); premium members see their LPI as a percentile against members of their age group | Took short daily sessions. Avoided a single index, percentiles and overclaiming |
| Elevate  | Skill games with performance tracking that shows "how you compare with others"                                                | Avoided comparing players: you are compared only with your own history          |

**Why SART**

- **It measures something linked to wellbeing.** Minds wandered in 46.9% of experience samples, and wandering was associated with lower happiness [R] (Killingsworth & Gilbert 2010).
- **It connects to mindfulness.** 8 minutes of mindful breathing reduced SART markers of mind-wandering [R] (Mrazek et al. 2012).
- **Its markers are well studied.** RT variability, anticipations and omissions are associated with disengagement [R] (Cheyne et al. 2009), and higher variability just before a probe with off-task reports [R] (Bastian & Sackur 2013; Seli et al. 2013b). This is a group-level association, so Steady shows it as a reflection prompt, not a detector.
- **It doesn't overclaim.** Evidence for broad transfer from brain training is weak [R] (Simons et al. 2016), and the FTC fined Lumosity $2M in 2016 for unsubstantiated claims.

## 3. How it plays, and what brings people back

- **Task [R]:** digits 1–9; press for every digit except **3**. Each trial is a 250 ms digit and a 900 ms mask, in 5 font sizes (Robertson et al. 1997; PsyToolkit).
- **Length [P]:** 81 trials (9 of each digit, so 11% no-go as in the original) with 3 probes take **about 2 minutes**. A walkthrough as a new player found the earlier 126 trials (about 5 minutes on a first visit) too long (Spec 005). That is much shorter than the standard 225 trials, so error rates are noisier (one 3 moves the catch rate by 11 points), and this version has not been validated.
- **Fair sequences [P]:** the server picks a seed for each session; it fixes a balanced digit order and the probe positions, and is never sent to the browser.
- **Practice [P]:** the rules are shown as steps before every session and say that everyone presses on some 3s. A first play-test at full speed was impossible to follow, so the first session's practice (12 digits, about 30 seconds) **starts slow and ends at the real speed**. The real session always uses the standard timing, so results stay comparable.
- **No live score** during the block, since it would change how people respond. The reward comes afterwards: a _session journey_ ribbon of every trial and your longest steady run.
- **Weekly target (4 of 7 days), not a daily streak.** A streak drops to zero after one missed day, but missing one opportunity did not materially affect habit formation in a 12-week study [R] (Lally et al. 2010). A focus check is also most useful on a bad day, and a flexible target removes the pressure to play only to keep a count [P].
- **No leaderboards or percentiles:** comparing attention with colleagues would discourage honest use, and a shortened task has no norms to rank against.
- **Coming back pays off in comparison, not points:** from session 3, Results compares today with your earlier sessions, and from session 7 with where you started.

## 4. Scoring

All scoring runs **on the server, from the raw trial data**, which is stored unchanged with a `scoring_version`, so history can be re-scored when the rules change. The client never sends a score. There is no composite score:

| Metric                | Definition                                                                               |
| --------------------- | ---------------------------------------------------------------------------------------- |
| Commission error rate | Presses on a 3 ÷ 9, shown as catch rate ("8 of 9")                                       |
| Omission rate         | Missed presses on go digits ÷ 72                                                         |
| Median go RT          | Median RT of correct go trials                                                           |
| RT variability (CV)   | SD ÷ mean of the same trials; lower = steadier                                           |
| d′ (secondary)        | Log-linear corrected [R] (Hautus 1995; Stanislaw & Todorov 1999); labelled noisy (n = 9) |

- **What counts as a good result:** there is no pass mark. In standard SART studies people typically press on 30–50% of no-go digits and miss 5–10% of go digits [R] (Wilson et al. 2016), so pressing on some 3s is normal. Those figures come from longer versions and other samples, so they are not shown as norms; a result is judged against the player's own history (§6).
- **Speed–accuracy trade-off [R]:** slower responding reduces errors (Seli et al. 2013a), so errors are always shown next to median RT and never ranked alone.
- **Mistakes and outliers [P]:** presses under 100 ms are anticipations; the 1150 ms response window bounds the slow end. The first 5 trials and the 3 after each probe count for accuracy but not for RT, because slowing after an interruption is not mind-wandering. With fewer than 10 usable RTs, RT statistics are left empty rather than estimated.

## 5. Data integrity vs. behaviour

- **Technical problems reject a session:** trials that do not match the server's plan, more than one response per trial, timestamps out of order, or a session that finished faster than its trials allow. Leaving the tab voids a session; an unsubmitted one expires after 30 minutes and is never scored.
- **Behaviour is only flagged [P]:** many omissions, many anticipations (the 100 ms cut-off is borrowed from the PVT's false-start rule, Basner & Dinges 2011), or machine-like regular timing (RT CV < 0.05). Flagged sessions **stay in trends** with a marker: excluding them would hide exactly the players who are struggling.
- The server never labels a session as cheating. The checks make faking costly, but browser input can't be fully trusted.

## 6. Progress

- **Starting point [P]:** the median of sessions 2–6, fixed once set (session 1 is practice). **Recent [P]:** the median of the last 5 sessions. Progress reads "recent vs. where you started", with an arrow and words per metric, and one summary sentence in the same words as Results.
- **Noise band [P]:** a change within ordinary session-to-session noise reads "Similar" (≈), not better or worse: for example, one extra caught 3 is not progress.
- **Charts:** catch rate, omissions, median RT and RT variability side by side, so speed and accuracy are always seen together.
- **Exploratory patterns** are collapsed below the charts. A sleep or stress split is drawn only once two groups have **at least 10 sessions**, as raw dots with `n` and a median, and is worded "a pattern so far, not a cause". Variability before probes is shown in the same descriptive way.

## 7. Privacy and security

- **Anonymous players:** a player is a random 256-bit token; the server stores only its SHA-256 hash. Player IDs never come from URLs or bodies, every query is scoped to the token's player, and another player's session is a `404`. No name or email is stored, and `DELETE /me` removes everything. There is no recovery by design.
- **Operator view, designed but not built:** an employer or operator would see aggregates only, with separate sign-in, at least 10 players per group and no drill-down to a person (OAIC APP 3 and APP 11). It is not built because aggregates need real players, and charts from invented data would break §6. Design and wireframe: [operator-view.md](operator-view.md).

## 8. Trade-offs and limitations

- **Storing exact trials and raw responses** costs space but makes every result recomputable and auditable.
- **Not a clinical tool:** browser timing adds jitter; keyboard and touch differ, so each session records its input device; practice effects inflate early gains; all insights are within-person and exploratory.
- **With more time:** an n-of-1 experiment where players sometimes do mindful breathing first, assigned at random; a speed–accuracy-corrected error score; a task-switching mode.

## Sources

- Robertson, I. H. et al. (1997). 'Oops!': Performance correlates of everyday attentional failures in traumatic brain injured and normal subjects. _Neuropsychologia_, 35(6), 747–758. https://pubmed.ncbi.nlm.nih.gov/9204482/
- PsyToolkit SART implementation (parameters). https://www.psytoolkit.org/experiment-library/sart.html
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
