# Design Note — Steady: a three-minute daily focus check

## 1. The idea

Steady is a calm attention game built on the **Sustained Attention to Response Task (SART)**, with brief **thought probes** that ask "where was your mind just now?". It shows how accurate, fast and steady your attention was today and helps you notice when your mind drifts. It does not promise to make you smarter. Attention changes from day to day, so results are shown against your own history, alongside an optional sleep/stress check-in.

**[R]** marks claims from published research; **[P]** marks my own product decisions, which research has not validated.

## 2. What I looked at

| Task              | Why considered                                                     | Decision                                                       |
| ----------------- | ------------------------------------------------------------------ | -------------------------------------------------------------- |
| Stroop            | Inhibitory control; simple interaction                             | Measures conflict between word and colour, not focus over time |
| N-back            | Working memory                                                     | Hard to learn; transfer claims contested                       |
| Task switching    | Cognitive flexibility; fits a workday full of interruptions        | Strong alternative                                             |
| PVT               | Vigilance; very sensitive to sleep loss [R] (Basner & Dinges 2011) | Little to engage players                                       |
| **SART + probes** | **Sustained attention plus self-reflection**                       | **Selected**                                                   |

Breath counting is a validated behavioural measure of mindfulness [R] (Levinson et al. 2014), but scoring depends on people counting their own breaths, which a browser cannot verify.

**Why SART**

- **It measures something linked to wellbeing.** In one experience-sampling study of about 2,250 adults, minds wandered in 46.9% of samples, and wandering was associated with lower happiness [R] (Killingsworth & Gilbert 2010).
- **It connects to mindfulness.** In one study, 8 minutes of mindful breathing reduced behavioural markers of mind-wandering on the SART compared with relaxation or reading [R] (Mrazek et al. 2012).
- **Its markers are well studied.** RT variability, anticipations and omissions are associated with disengagement [R] (Cheyne et al. 2009). Higher RT variability in the trials just before a probe is associated with off-task reports [R] (Bastian & Sackur 2013 in the SART; Seli et al. 2013b in a rhythm task). This is a **group-level association**. Steady shows it as a reflection prompt, not as a detector of mind-wandering.
- **It doesn't overclaim.** Evidence for broad transfer from brain training is weak [R] (Simons et al. 2016), and the FTC fined Lumosity $2M in 2016 for unsubstantiated claims.

## 3. How it plays

- **Task [R]:** digits 1–9; press for every digit except **3**. Each trial is 250 ms digit + 900 ms mask, a fixed 1150 ms. Font size varies across 5 sizes, and the same digit never appears twice in a row (Robertson et al. 1997; PsyToolkit).
- **Length [P]:** 126 trials (14 of each digit, so 11% no-go, as in the original) take 144.9 s. With 4 probes, a countdown and the check-in, a session takes **about 3 minutes**. It is shorter than the standard 225 trials, so error rates are noisier, and this shortened version has not been validated.
- **Sequence [P]:** the server creates a seed when the session starts. The seed determines a balanced sequence (exactly 14 of each digit, drawn without ever repeating the previous digit, and no 3 in the first 5 warm-up trials) and the probe positions (after a go trial, 25–35 trials apart). A probe **pauses** the trial clock.

### Making it a game, not a lab task [P]

The SART is monotonous by design, so the gamification is restrained, and it must not change how people respond.

- **Clear goal and practice:** "Catch every 3, keep a steady rhythm." The first session includes an 18-trial practice round with feedback after each trial, as in the standard training block.
- **No live score during the main block.** A live score would change how people respond. Visuals stay calm and never affect stimulus timing.
- **The reward comes afterwards:** a _session journey_ ribbon shows every trial (steady stretches, caught and missed 3s, where you said you drifted), plus your longest steady run.
- **Weekly target (4 of 7 days) instead of a daily streak; no leaderboards.** Comparing attention scores with colleagues would discourage honest use.

## 4. Scoring

All scoring runs **on the server, from the raw trial data**, which is stored unchanged. The client sends responses and timings, never scores. Results carry a `scoring_version`, so they can be recomputed when the rules change. There is no composite score:

| Metric                | Definition                                                                                                                                                                                                 |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Commission error rate | Presses on a 3 ÷ 14 ("Caught 12 of 14 threes")                                                                                                                                                             |
| Omission rate         | Missed presses on go digits ÷ 112                                                                                                                                                                          |
| Median go RT          | Median RT of correct go trials, excluding transition trials                                                                                                                                                |
| RT variability (CV)   | SD ÷ mean of the same trial set; lower = steadier                                                                                                                                                          |
| d′ (secondary)        | The response is _withholding_: hit = withheld on a 3, false alarm = withheld on a go digit. `z(H) − z(F)`, with log-linear correction [R] (Hautus 1995; Stanislaw & Todorov 1999). Labelled noisy (n = 14) |

- **Transition trials [P]:** the first 5 trials of a session and the 3 after each probe. The scoring rule identifies them from trial index and probe positions; they are not flagged at capture time. They count towards accuracy but are excluded from RT statistics, because slowing after an interruption is not mind-wandering. This is my analysis rule, not part of the standard SART, and it is versioned so it can change.
- **Speed–accuracy trade-off [R]:** slower responding reduces SART errors (Seli et al. 2013a). Errors are always shown next to median RT and never ranked alone.

## 5. Data integrity vs. behaviour

- **Technical validity, checked strictly; a failure means the session is rejected:**
  - the trial count and order match the seed;
  - at most one response per trial;
  - timestamps are present and increasing;
  - total duration is within tolerance.

  Leaving the tab during play voids the session: nothing is submitted, and the open session expires after 30 minutes without ever being scored or shown in results or progress. Only complete sessions count.

- **Behavioural flags, descriptive only:**
  - many omissions;
  - many anticipations (RT < 100 ms) [P]. The cut-off is a pre-declared heuristic borrowed from the PVT, where RTs < 100 ms count as false starts (Basner & Dinges 2011), not an established SART standard;
  - unusually regular timing (RT CV < 0.05) [P].

  Flagged sessions **stay in trends**, with a visible marker. Excluding them automatically would hide exactly the players whose attention is struggling.

The server never labels a session as cheating. Integrity checks make faking results costly, but browser timing can't be fully trusted.

## 6. Progress

- **Initial baseline [P]:** the median of valid sessions 2–6. Once set, it stays fixed. Session 1 is marked as practice and still plotted.
- **Recent performance [P]:** the median of the last 5 sessions, updated continuously. The card reads "recent vs. where you started", which keeps both reference points unambiguous.
- **Charts:** catch rate, omissions, median RT and RT variability, shown side by side so speed and accuracy are always visible next to variability.
- **Check-in comparisons are exploratory:**
  - The split by sleep or stress is shown as raw per-session dots, always labelled with n.
  - A text summary appears only when each group has **at least 10 sessions**, and it is worded as "a pattern so far, not a cause".
  - Pre-probe variability is shown in the same descriptive way.

## 7. Privacy and security

- **Anonymous player identity:**
  - Creating a player returns a random 256-bit token once. The client keeps it, and the server stores only its SHA-256 hash.
  - A NestJS guard resolves the player from `Authorization: Bearer <token>` on every request.
  - Player IDs are never taken from URLs or request bodies. Every query is scoped to the resolved player.
  - Integration tests assert that requests for another player's sessions return 404.
- **Minimal data:** no name, email or other personal details; only results and the optional check-in. `DELETE /me` removes everything.
- **Limitation:** this identifies players but does not authenticate them. There is no recovery by design, so a lost token means a lost history.
- **Future extension:** employer tenancy and SSO, with employers seeing aggregates only. That design would follow the OAIC's APP 3 and APP 11 guidance for sensitive information.

## 8. Trade-offs and limitations

- **Every session keeps its exact trials and raw responses** (126 trials plus probes) in exchange for results that can be recomputed and audited. The scoring logic is pure functions and is the most heavily tested part. Stack details are in the README.
- **Not a clinical tool.**
  - Browser timing adds jitter, and touch and keyboard RTs differ. Each session uses one input method (Space on a keyboard, or tapping on a touch screen), and that device is stored with the session.
  - Practice effects inflate early gains.
  - All insights are within-person and exploratory.
- **With more time:** an n-of-1 experiment where each player sometimes does mindful breathing first, assigned at random; a speed–accuracy-corrected error score; and a task-switching mode.

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
- Levinson, D. B. et al. (2014). A mind you can count on: Validating breath counting as a behavioral measure of mindfulness. _Frontiers in Psychology_, 5, 1202. https://doi.org/10.3389/fpsyg.2014.01202
- OAIC. Australian Privacy Principles guidelines (APP 3, APP 11). https://www.oaic.gov.au/privacy/australian-privacy-principles
