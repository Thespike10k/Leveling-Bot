# AeroX Leveling System

A high-performance, aesthetically driven Discord leveling and engagement bot built for the modern era. Featuring **Discord Components V2**, advanced canvas rendering, and a robust data architecture — with blazing-fast response times and automated synchronization.

---

## Credits

- **Development Team** — [AeroX Development](https://github.com/AeroXDevs)
- **Lead Developer** — [JoshNvrDie](https://joshh.fun/)
- **Support Server** — [discord.gg/aerox](https://discord.gg/aerox)
- **Developers Github Profile** — [JoshNvrDie](https://github.com/joshXnvrdie)

---

## Features

### 🎨 Visual & UI
Advanced rendering and UI standards for a premium user experience.

| Module | Description |
|---|---|
| Rank Cards | Custom-designed XP progress cards using `@napi-rs/canvas` |
| Profile Display | Rich multi-stat profiles with streaks and voice records |
| Components V2 | Fully optimized for Discord's latest `ContainerBuilder` standards |
| Responsive Layout | Dynamic UI updates and interactive button systems |

---

### 🎙️ Global Engagement
Integrated tracking for all forms of server activity.

**Core Mechanisms:**
- **Automated Text XP:** Smart message tracking with anti-spam cooldowns.
- **Voice XP Tracking:** Per-minute rewards for active voice participation.
- **Streak System:** Daily login rewards with XP multipliers for consistency.
- **Dynamic Rewards:** Role-based level rewards with stackable tiers.
- **Atomic Counting:** Unified message and voice tracking with 100% accuracy.

---

### 🛡️ Administration & Security
Hardcore branding protection and robust server management tools.

**Branding Guard:**
- Automatic credit verification on startup
- Forced UI branding in footer signatures for all bot panels
- Console-level license checks (Hardcoded protection)
- Auto-shutdown on credit removal (JoshNvrDie / Aerox Development)

---

## Commands Reference

| Category | Commands |
|---|---|
| Leveling (Public) | `rank`, `profile`, `leaderboard`, `streak`, `claimreward`, `rewards`, `serverstats` |
| Management (Admins) | `setup`, `multiplier`, `xpblacklist`, `voicexp`, `xpconfig`, `xpcooldown`, `xprange` |
| Advanced (Admins) | `givexp`, `setlevel`, `resetxp`, `setprefix` |
| Utility (Public) | `help`, `ping`, `stats` |
| Developer (Owner) | `backup` |

---

## Tech Stack

| Component | Technology |
|---|---|
| Language | JavaScript (Node.js) |
| Discord Library | discord.js v14 |
| Primary Database | SQLite (via better-sqlite3) |
| High-Speed Cache | Managed prefix and settings cache |
| Image Processing | @napi-rs/canvas, canvafy |
| Emoji Logic | Automated Emoji Sync System |

---

## Architecture Notes

- **Optimized Data Flow:** Uses Write-Ahead Logging (WAL) for SQLite to ensure database operations never block the main event loop.
- **Integrated Sync:** The internal `emojiSync` utility automatically populates your host application with required assets on first boot.
- **Modular Handlers:** Commands and events are loaded via a modern ESM handler architecture for maximum scalability.

---

## License

**Source Available License** — Copyright © 2025 JoshNvrDie.
Use of this source code is subject to the terms in the `LICENSE` file. All unauthorized distribution or commercial use is strictly prohibited.

---

## Support

Join the support server for help, updates, and announcements:
**[discord.gg/aerox](https://discord.gg/aerox)**
