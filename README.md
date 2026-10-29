# Overnight Garden

A small garden in your Claude Code status line that grows only while you're away.

```
🌱 Overnight Garden · 🌷 2  🌳 1  🍀 1  🌻 1
```

## Why it exists

AI agents compress weeks of work into hours. The danger is that rest gets compressed too: one more prompt before bed, a check-in at midnight, a weekend that blurs into the week. That's compression burnout.

Most tools answer with more nudges: break reminders, streaks, badges for "productive days". Overnight Garden does the opposite. It never says anything. It notices when you've been away and leaves a plant for you to find when you come back:

| Time away | What grows |
|---|---|
| 8+ hours (a night) | 🌷 a flower |
| 40+ hours (a weekend) | 🌳 a tree |
| 5+ days (a real break) | 🍀 a rare plant |
| Any 8+ hours, if the agent was still working 10+ minutes on your last prompt | 🌻 a golden flower as a bonus: hand off the work, then rest |

- **Only time away grows anything.** Working more never earns a plant, and short breaks grow nothing.
- **It never wilts, never resets, and never counts streaks.** A month off is rewarded, never punished. Plants are only ever added.
- **It gives time back.** It adds no notifications, prompts, questions or extra text to your conversations. It only lives in the status line, which you can glance at or ignore.

## What you need

- [Claude Code](https://claude.com/claude-code)
- [Node.js](https://nodejs.org) 20 or newer. Check with `node --version`.
- Git

It has no other dependencies and never uses the network. It works on macOS, Linux and Windows.

## Try it in a minute, without installing anything

```bash
git clone https://github.com/har27il/overnight-garden.git
cd overnight-garden
./demo.sh
```

On Windows PowerShell, run `node scripts/demo.js` instead of `./demo.sh`.

The demo makes a throwaway home folder, installs Overnight Garden into it, and plays out a weekday night, a lunch break, a weekend, a long agent handoff and a year left alone. It uses the real hooks, engine and status line, run the same way Claude Code runs them. The only thing it fakes is the clock. Then it uninstalls, checks your settings came back exactly, and deletes the throwaway folder. Your real `~/.claude` is never touched. Every line it prints is a check:

```
PASS install: settings backed up first, then 3 hooks and the status line added; your own settings kept
PASS weekday night: away 9 hours (Thu 22:00 → Fri 07:00) → grew 🌷 flower
PASS lunch break: away 1 hour (Fri 12:00 → Fri 13:00) → nothing grew, and nothing was lost
PASS weekend: away 63 hours (Fri 18:00 → Mon 09:00) → grew 🌳 tree
PASS long agent handoff: away 9 hours (Mon 23:00 → Tue 08:00), the agent worked 45 minutes first → grew 🌷 flower + 🌻 golden flower
PASS a year left alone: away 365 days (10 Nov 2026 → 11 Nov 2027) → grew 🍀 rare plant
PASS never wilts or resets: after a year away, all 5 plants are still there, in the order they grew
PASS no alerts: all 19 hook calls printed nothing and exited 0, so nothing was added to the conversation
PASS status line shows: 🌱 Overnight Garden · 🌷 2  🌳 1  🍀 1  🌻 1
PASS uninstall: settings are byte-for-byte what they were before install, and the garden is kept
PASS all 10 checks passed; throwaway home removed
```

## Install

From the `overnight-garden` folder:

```bash
node scripts/install.js
```

This backs up `~/.claude/settings.json` to `~/.claude/overnight-garden/settings.backup.json`, then adds three hooks and the status line. Restart Claude Code, and you'll see `🌱 Overnight Garden · grows while you rest` at the bottom. Your first flower appears the first time you come back after 8 hours away.

Keep the folder where it is, because the hooks run from it. Claude Code shows only one status line, so if you already have one, it's put aside while the garden is installed and comes back when you uninstall.

## Uninstall

```bash
node scripts/uninstall.js
```

This puts your settings back exactly as they were before you installed. If you changed other settings in the meantime, those changes are kept and only the garden's lines are removed. Your garden stays in `~/.claude/overnight-garden/` in case you come back. Delete that folder to remove it completely.

## How it works

- **Hooks.** Sending a prompt (`UserPromptSubmit`) or opening a session (`SessionStart`) means you're here. `Stop` means the agent finished its turn. When you come back after time away, the engine works out what grew and saves it.
- **Measuring time away.** "Away" runs from your last prompt, in any Claude Code window, to when you're back. Sessions that start because the agent's context was compacted don't count as you being back.
- **Files.** Everything lives in `~/.claude/overnight-garden/`:
  - `garden.json`: your plants.
  - `presence.json`: when you were last here.
  - The settings backup, while installed.
- **Staying silent.** The hooks always print nothing and exit cleanly, even if something goes wrong. The status line only ever shows known plant types, never text from the garden file.

| File | What it does |
|---|---|
| `src/engine.js` | The rules: what one absence grows. It never reads the clock; every time is passed in, in milliseconds. |
| `src/store.js` | Loads and saves the garden. It only ever adds plants, and never overwrites a file it can't read. |
| `src/presence.js` | Tracks when you were last here and turns a return into an absence. |
| `src/overnight-garden-hook.js` | The hook Claude Code runs. |
| `src/overnight-garden-statusline.js` | The status line Claude Code runs. |
| `src/settings.js` | Install and uninstall, with the backup. |
| `scripts/demo.js`, `scripts/demo-timeline.js` | The demo and its timeline. |

## Run the tests

```bash
npm test
```

The tests only ever use throwaway home folders, never your real `~/.claude`.

## Good to know

- Time away is counted from your last prompt. If you read the agent's answer for an hour before leaving, that hour counts as away.
- There's one garden per computer account, shared by every Claude Code window.
- Tested on Windows 11 with Node.js 24. The demo and tests run the installed commands exactly as they're written into `settings.json`, with the same kind of input Claude Code sends.

## License

MIT. See [LICENSE](LICENSE).
