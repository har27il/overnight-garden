# Overnight Garden

A Claude Code add-on that grows a small garden in the status line, only while the user is away.

- 8h+ away: a flower
- 40h+ away: a tree
- 5+ days away: a rare plant
- Golden flower if the agent ran 10+ min before the user left

It never wilts, never resets and never counts streaks. Time away only ever adds to the garden.

## How it's judged
An agent reads this repo's README and code and scores it on:
- 30%: it's about compression burnout
- 30%: it actually works end to end, with nothing faked
- 20%: a stranger can start from the README
- 20%: it gives time back, with no added alerts or prompts

What this means while building:
- The status line is the garden's only surface. No notifications, alerts, prompts or questions.
- demo.sh and the tests run the real code. To show "8 hours away" without waiting, pass a simulated time into the real engine.

## Build steps (in order)
1. Engine
2. Claude Code hooks + status line
3. Garden card
4. demo.sh
5. README

## Standing rules
- One task per branch, with a PR per task. Never push to main, merge, or force-push. The user merges.
- The user is non-technical and doesn't read code. Explain every change in plain English, and prove it works with real test or demo output.
- Stop and ask whenever something needs the user's login or approval. This includes pushing a branch and opening its PR: say what's about to go up, then wait for an OK.
