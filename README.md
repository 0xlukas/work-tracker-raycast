# Work Tracker for Raycast

Raycast commands for [WorkTracker](https://github.com/0xlukas/work-tracker): log time, run the timer, see your balance, log calls and check vacation left, without opening the app. Everything goes through WorkTracker's own assistant server, so entries made here follow the app's rules and sync to your other Macs like entries made in the app.

## Commands

| Command | What it does |
|---|---|
| **View Today** | Today's entries with project colours and notes; worked, expected and the day's balance; holidays and absences; this week's balance; the running timer. The dropdown goes back two weeks. Edit (↵ on an entry), add (⌘N), copy or delete (⌃X) entries. |
| **Add Work Entry** | Day, start, end, project and note. Starts where the day's last entry ends and, today, ends now; the project is the one you worked on last. Times take `8`, `830`, `8:30` or `8.30`; `24:00` ends at midnight. The window closes with a confirmation; fix mistakes in View Today. Entries added from a list (View Today, a period's days, Days Without Entries) offer **Undo** (⌘Z) in the toast, since that list stays open. |
| **Start or Stop Timer** | Projects, the most recent first. ↵ starts the timer (switching from a running one saves it first); **Start at…** (⌘T) when you forgot. The running timer stops with ↵, **Stop at…** (⌘T) or is discarded (⌃X). |
| **Work Balance** | WorkTracker's overview: today, this week, month and year (worked of expected, balance), all-time overtime with the opening balance, vacation left, days without entries, the timer and sync problems. ↵ opens the days of a period (months for the year), its projects and absences. |
| **Log Call** | Caller and topic pick from the last year's calls (latest first, the caller's own topics first) or take what you type; the department follows the caller's last call. Length, **Solved by me** (⌘M), note and an optional time (sent in Zurich time). The window closes with a confirmation; edit calls in WorkTracker. |
| **Vacation Left** | A year's allowance (entitlement, carried over, used, left), absences coming up and taken. **Record Absence…** (⌘N) for a range of days in any category, half days included; remove one (⌃X). Recording over existing absences (another category, or full instead of half days) asks first and lists the days; **Undo** is offered when the range had no absences before. |
| **Days Without Entries** | Past working days with neither entries nor an absence, most recent first. Add an entry, or record an absence for the day (⌘B), full or half day, with the same check and Undo. |
| **Daily Quote** | The quote WorkTracker shows when it opens, the same one on the same day. ⌘⇧C copies it. |

Every view has **Open WorkTracker** (⌘O) and **Refresh** (⌘R). There's no menu bar command: WorkTracker's own menu bar item already shows today's hours, the week's balance and the timer, and logs calls.

## Setup

On each Mac:

1. In WorkTracker, turn on **Settings › Assistants › Let AI assistants use Work Tracker**. It's off by default and per Mac. This is the one step the extension can't do for you; it never changes WorkTracker's settings.
2. Install the extension (below).

That's all. The extension reads the server's port and key from WorkTracker's preferences (`defaults read com.worktracker.app assistantServerPort` / `assistantServerToken`), so **New Key** in WorkTracker needs nothing here. If the server is off, WorkTracker isn't running, the key is refused or WorkTracker is too old for a tool, each command says so and offers **Open WorkTracker**. If WorkTracker doesn't answer a change in time, the message says it may still have been saved, so check before trying again.

The extension's preferences (**Assistant Key**, **Port**) are only for pointing it at another WorkTracker build, such as a test build. Leave them empty otherwise.

### Installing into Raycast

```sh
git clone https://github.com/0xlukas/work-tracker-raycast.git ~/code/personal/work-tracker-raycast
cd ~/code/personal/work-tracker-raycast
npm ci
npm run dev    # imports the extension into Raycast; stop it with ⌃C once the commands show up
```

The commands stay in Raycast after `npm run dev` stops. To update, `git pull && npm ci && npm run dev` again. The extension isn't in the Raycast Store.

## How it talks to WorkTracker

WorkTracker runs an [MCP](https://modelcontextprotocol.io) server on `http://127.0.0.1:47615/mcp` (loopback only, bearer key). Each command calls its tools over plain HTTP:

- **Reading:** `get_overview`, `get_summary`, `list_entries`, `list_projects`, `get_vacation`, `list_absences`, `list_absence_categories`, `list_days_without_entries`, `list_calls`, `get_call_summary`.
- **Writing:** `add_entries`, `update_entry`, `delete_entries`, `start_timer`, `stop_timer`, `discard_timer`, `set_absences`, `remove_absences`, `log_call`, `delete_calls`.

The numbers are WorkTracker's own (its calculator, schedule changes, Zurich holidays, absence categories, vacation allowance), so the extension computes nothing itself. Its refusals (an overlapping entry, an archived project, a day without scheduled hours) appear as they are in a toast.

Earlier versions read and wrote WorkTracker's SwiftData store directly with `sqlite3`. Entries made that way didn't sync and skipped the app's checks; the extension no longer touches the database.

## Development

```sh
npm ci
npm run build          # type-check and build into dist/ (doesn't touch Raycast)
npm run lint
npm test               # unit tests, and the MCP client against a fake server
npm run sync-quotes    # copy the quotes from WorkTracker's DailyQuote.swift
```

`npm test` also runs live tests against a running WorkTracker **test build** when `WORKTRACKER_TEST_PORT` and `WORKTRACKER_TEST_KEY` are set. They refuse the real app's port and key. How to set one up is in `CLAUDE.md`.

| Where | What |
|---|---|
| `src/lib/mcp.ts` | The MCP client (one `tools/call` per request; the server is stateless) |
| `src/lib/config.ts` | Finding the port and key |
| `src/lib/api.ts`, `types.ts` | The tools, typed |
| `src/lib/ui.tsx` | Error views and toasts, shared actions, colours |
| `src/components/` | Views shared between commands |
| `src/*.tsx` | One file per command |

Project rules for agents are in `CLAUDE.md`.
