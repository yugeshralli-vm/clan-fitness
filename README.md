# Clan Fitness

Track gym days, steps, and food with a small group of people who'll actually notice if you skip.
A social fitness accountability app — join a "clan" of up to 15 people, log daily, react and
comment on each other's check-ins, and climb a weekly leaderboard.

**Live at:** [clanfitness.in](https://www.clanfitness.in)

## Tech stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Database:** Neon Postgres + Drizzle ORM
- **Auth:** Clerk
- **Push notifications:** Web Push (VAPID) via a custom service worker
- **Email:** Resend
- **File storage:** Vercel Blob (check-in photos)
- **Analytics:** Vercel Web Analytics + Speed Insights
- **Hosting:** Vercel

## Features

### Core loop
- Daily check-ins for gym, steps, and food — up to 3 photos per food log, shown as a carousel
- Streaks and a weekly leaderboard, scored from step/streak/gym weights (admin-tunable, no deploy needed)
- Per-clan activity feed with @mention comments and reactions (🔥 👏 👎)

### Clans
- Create a clan or join one via invite code or a shareable link (up to 15 people)
- Manage page: leaderboard, members, invite code regeneration, rename, leave, or delete (admin only)
- Nudge members who haven't logged today (capped at once per person per day)
- A welcome moment and first-time goals prompt right after joining

### Notifications
- Push (Web Push), email (Resend), and in-app (bell with unread count) — all three fire per event, not one replacing another
- PWA home-screen app icon badge with the live unread count (Android + iOS 16.4+)
- Types: comments, mentions, reactions, check-ins, missed-log reminders, nudges, feedback replies, admin broadcasts

### Onboarding & PWA
- Guided flow: sign up → create or join a clan → set goals
- Installable PWA with a custom install prompt, real app icon/favicon/logo branding, and a service worker

### Feedback
- Floating feedback button (bottom-sheet chat) for testers to message the admin directly
- Admin sees and replies to every tester's thread from `/admin`

### Admin panel
`/admin`, gated to a fixed account:
- **Config** — tune leaderboard weights and default targets live, no deploy
- **Broadcast** — message selected clans or specific individual users, with a reach estimate, a confirm step, and send history
- **Feedback** — every tester's chat thread in one place
- Notification delivery health (sent/failed/skipped counts, recent failures)

## Changelog

### 2026-07-17
- Preserve current tab when switching clans ([#91](https://github.com/yugeshralli-vm/clan-fitness/pull/91))
- Move chat reaction removal into the reactor sheet ([#90](https://github.com/yugeshralli-vm/clan-fitness/pull/90))
- Tap a chat message to see who reacted; one reaction per member ([#89](https://github.com/yugeshralli-vm/clan-fitness/pull/89))
- Move clan chat from floating button to a bottom nav tab ([#88](https://github.com/yugeshralli-vm/clan-fitness/pull/88))
- Add hold-to-react on clan chat messages ([#87](https://github.com/yugeshralli-vm/clan-fitness/pull/87))
- Show 2 lines of the quoted reply preview instead of 1 ([#86](https://github.com/yugeshralli-vm/clan-fitness/pull/86))
- Cap reply-quote preview width independent of ancestor flex sizing ([#85](https://github.com/yugeshralli-vm/clan-fitness/pull/85))
- Fix recurring production build failures with a lazy DB client ([#84](https://github.com/yugeshralli-vm/clan-fitness/pull/84))
- Fix reply-quote preview inflating the whole chat bubble ([#83](https://github.com/yugeshralli-vm/clan-fitness/pull/83))
- Fix chat message/reply-quote overflowing off-screen ([#82](https://github.com/yugeshralli-vm/clan-fitness/pull/82))
- Only notify on mentions and replies in clan chat ([#81](https://github.com/yugeshralli-vm/clan-fitness/pull/81))
- Fix reply quote bubble overflowing off-screen ([#80](https://github.com/yugeshralli-vm/clan-fitness/pull/80))
- Fix clan chat scroll/avatar-link bugs and add swipe-to-reply ([#79](https://github.com/yugeshralli-vm/clan-fitness/pull/79))
- Add haptic feedback to core interactive elements ([#78](https://github.com/yugeshralli-vm/clan-fitness/pull/78))
- Let members view each other's profiles ([#77](https://github.com/yugeshralli-vm/clan-fitness/pull/77))
- Add @mentions and an unread badge to clan chat ([#76](https://github.com/yugeshralli-vm/clan-fitness/pull/76))
- Turn 1:1 feedback chat into a per-clan group chat ([#75](https://github.com/yugeshralli-vm/clan-fitness/pull/75))

### 2026-07-16
- Fix Clerk API rate limiting causing errors on /profile, /logs, etc. ([#74](https://github.com/yugeshralli-vm/clan-fitness/pull/74))

### 2026-07-15
- Show only the latest entry per type in a feed card ([#73](https://github.com/yugeshralli-vm/clan-fitness/pull/73))

### 2026-07-14
- Fix background scroll leaking behind the image lightbox ([#72](https://github.com/yugeshralli-vm/clan-fitness/pull/72))
- Auto-grow daily log's text fields while typing ([#71](https://github.com/yugeshralli-vm/clan-fitness/pull/71))
- Restyle DailyLogForm into clear bordered sections with icons ([#70](https://github.com/yugeshralli-vm/clan-fitness/pull/70))
- Add "Thought" label above the daily thought input ([#69](https://github.com/yugeshralli-vm/clan-fitness/pull/69))
- Add an optional "What's on your mind?" daily thought ([#68](https://github.com/yugeshralli-vm/clan-fitness/pull/68))
- Show all day-of-week labels in the Activity heatmap ([#67](https://github.com/yugeshralli-vm/clan-fitness/pull/67))
- Redesign Profile into a summary page with Activity heatmap and History ([#66](https://github.com/yugeshralli-vm/clan-fitness/pull/66))

### 2026-07-13
- Add per-user timezone for daily check-in logic ([#65](https://github.com/yugeshralli-vm/clan-fitness/pull/65))
- Improve SEO for the landing page ([#64](https://github.com/yugeshralli-vm/clan-fitness/pull/64))
- Block saving a log while a photo upload has failed ([#63](https://github.com/yugeshralli-vm/clan-fitness/pull/63))
- Fix feed pagination splitting a person's own check-ins across pages ([#62](https://github.com/yugeshralli-vm/clan-fitness/pull/62))
- Fix UTC-vs-IST day boundary bug and bump feed page size ([#61](https://github.com/yugeshralli-vm/clan-fitness/pull/61))

### 2026-07-12
- Rename weekly top-3 label to "Wall of Fame" ([#60](https://github.com/yugeshralli-vm/clan-fitness/pull/60))
- Add app-wide toast notifications for action feedback ([#59](https://github.com/yugeshralli-vm/clan-fitness/pull/59))
- Add a Yesterday period to the leaderboard picker ([#58](https://github.com/yugeshralli-vm/clan-fitness/pull/58))
- Fix Clerk middleware blocking the cron route ([#57](https://github.com/yugeshralli-vm/clan-fitness/pull/57))
- Let the leaderboard tab show Today / This Week / This Month ([#56](https://github.com/yugeshralli-vm/clan-fitness/pull/56))
- Add weekly Top 3 / Wall of Shame system posts ([#55](https://github.com/yugeshralli-vm/clan-fitness/pull/55))

### 2026-07-11
- Write a real README: features and changelog ([#54](https://github.com/yugeshralli-vm/clan-fitness/pull/54))
- Fix blank white box in Android notification shade ([#53](https://github.com/yugeshralli-vm/clan-fitness/pull/53))
- Show unread count on the PWA home-screen app icon ([#52](https://github.com/yugeshralli-vm/clan-fitness/pull/52))
- Replace placeholder icons with the real Clan Fitness logo ([#51](https://github.com/yugeshralli-vm/clan-fitness/pull/51))
- Let broadcasts target individual users, not just clans ([#50](https://github.com/yugeshralli-vm/clan-fitness/pull/50))
- Fix inconsistent admin tab-label truncation on Safari ([#49](https://github.com/yugeshralli-vm/clan-fitness/pull/49))
- Fix admin panel responsiveness, make feedback chat a bottom sheet ([#48](https://github.com/yugeshralli-vm/clan-fitness/pull/48))
- Add admin broadcast messages, repurposing the Notifications tab ([#47](https://github.com/yugeshralli-vm/clan-fitness/pull/47))
- Merge feedback chat + admin email gating into main ([#46](https://github.com/yugeshralli-vm/clan-fitness/pull/46))
- Add in-app feedback chat between testers and the admin ([#45](https://github.com/yugeshralli-vm/clan-fitness/pull/45))
- Gate `/admin` by email instead of an env var ([#44](https://github.com/yugeshralli-vm/clan-fitness/pull/44))
- Let clan admins share the invite link from the welcome screen ([#43](https://github.com/yugeshralli-vm/clan-fitness/pull/43))
- Swap flex emoji for thumbs down, polish photo carousel indicators ([#42](https://github.com/yugeshralli-vm/clan-fitness/pull/42))
- Add sign-out escape hatch to the onboarding page ([#41](https://github.com/yugeshralli-vm/clan-fitness/pull/41))
- Fix database driver leaking into the browser bundle — the real "page couldn't load" cause ([#40](https://github.com/yugeshralli-vm/clan-fitness/pull/40))
- Fix InstallPrompt's polling loop running forever on iOS ([#39](https://github.com/yugeshralli-vm/clan-fitness/pull/39))
- Let clan admins delete the clan from clan settings ([#38](https://github.com/yugeshralli-vm/clan-fitness/pull/38))

### 2026-07-10
- Fix welcome page failing to load after clan creation ([#37](https://github.com/yugeshralli-vm/clan-fitness/pull/37))
- Add a custom PWA install prompt — Phase 2, Part B ([#36](https://github.com/yugeshralli-vm/clan-fitness/pull/36))
- Polish homepage, empty feed, sign-up, and onboarding copy — Phase 2, Part A ([#35](https://github.com/yugeshralli-vm/clan-fitness/pull/35))
- Replace silent auto-subscribe with an explicit notification permission prompt ([#34](https://github.com/yugeshralli-vm/clan-fitness/pull/34))
- Add welcome moment + first-time goals prompt after joining a clan ([#33](https://github.com/yugeshralli-vm/clan-fitness/pull/33))
- Fix invite link preview showing 404 — missing `/join` in proxy public routes ([#29](https://github.com/yugeshralli-vm/clan-fitness/pull/29))
- Fix mention list being clipped in an empty comment thread ([#32](https://github.com/yugeshralli-vm/clan-fitness/pull/32))
- Fix same-day check-in missing from a newly joined clan's feed ([#31](https://github.com/yugeshralli-vm/clan-fitness/pull/31))
- Show clan name in invite link previews ([#30](https://github.com/yugeshralli-vm/clan-fitness/pull/30))
- Revert bottom-nav-jump fix — broke Android navigation, three follow-ups didn't resolve it ([#28](https://github.com/yugeshralli-vm/clan-fitness/pull/28))
- Fix missing bottom nav on Android — `100svh` instead of `100dvh` ([#27](https://github.com/yugeshralli-vm/clan-fitness/pull/27))
- Stop-gap: disable pull-to-refresh touch handling to fix Android scroll ([#26](https://github.com/yugeshralli-vm/clan-fitness/pull/26))
- Fix Android scroll regression from #24 — missing `dvh` fallback ([#25](https://github.com/yugeshralli-vm/clan-fitness/pull/25))
- Stop using `position: fixed` for header/bottom nav — attempted proper fix for the mobile jump ([#24](https://github.com/yugeshralli-vm/clan-fitness/pull/24))
- Reduce bottom nav jump on mobile scroll ([#23](https://github.com/yugeshralli-vm/clan-fitness/pull/23))
- Add a nudge feature for members who haven't logged today ([#22](https://github.com/yugeshralli-vm/clan-fitness/pull/22))
- Let members leave a clan from the members list ([#21](https://github.com/yugeshralli-vm/clan-fitness/pull/21))

### 2026-07-09
- Add admin dashboard: tunable config + notification health ([#20](https://github.com/yugeshralli-vm/clan-fitness/pull/20))

### 2026-07-08
- Install Vercel Speed Insights ([#19](https://github.com/yugeshralli-vm/clan-fitness/pull/19))
- Install Vercel Web Analytics ([#17](https://github.com/yugeshralli-vm/clan-fitness/pull/17))
- Vary nutrition feed captions by status ([#16](https://github.com/yugeshralli-vm/clan-fitness/pull/16))
- Show clean `@Name` while composing a mention ([#14](https://github.com/yugeshralli-vm/clan-fitness/pull/14))
- Fix reactions/comments disappearing when a day's log gets a new check-in type ([#15](https://github.com/yugeshralli-vm/clan-fitness/pull/15))
- Scope reactions and comments per clan ([#13](https://github.com/yugeshralli-vm/clan-fitness/pull/13))

### 2026-07-07
- Score the leaderboard on steps only, not gym ([#12](https://github.com/yugeshralli-vm/clan-fitness/pull/12))
- Fall back to legacy `photoUrl` for pre-carousel check-ins ([#11](https://github.com/yugeshralli-vm/clan-fitness/pull/11))
- Support up to 3 photos per food check-in, shown as a carousel ([#10](https://github.com/yugeshralli-vm/clan-fitness/pull/10))
- Decouple photo upload from nutrition status ([#9](https://github.com/yugeshralli-vm/clan-fitness/pull/9))
- Performance pass: indexes, redundant queries, Suspense-streamed badges ([#8](https://github.com/yugeshralli-vm/clan-fitness/pull/8))
- Show date/weekday in logs progress card ([#7](https://github.com/yugeshralli-vm/clan-fitness/pull/7))
- Disable text-selection and iOS callout app-wide ([#6](https://github.com/yugeshralli-vm/clan-fitness/pull/6))
- Fix janky bottom sheet slide-in animation ([#5](https://github.com/yugeshralli-vm/clan-fitness/pull/5))
- Suppress native copy/callout on reaction long-press ([#4](https://github.com/yugeshralli-vm/clan-fitness/pull/4))
- Show who reacted on long-press ([#3](https://github.com/yugeshralli-vm/clan-fitness/pull/3))
- Add active-clan tracking and join-another-clan entry point ([#2](https://github.com/yugeshralli-vm/clan-fitness/pull/2))
- Fix production break: check-ins visible across all of a user's clans ([#1](https://github.com/yugeshralli-vm/clan-fitness/pull/1))
