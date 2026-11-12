# Smart Tasks & Reminders (My Planner)

Self-contained module. It doesn't change the legacy `Task` model or `/api/tasks`.

| Layer | Location |
|---|---|
| Data model | `prisma/schema.prisma`, models `Planner*` (collections `planner_*`) |
| REST API | `routes.ts`, mounted at `/api/planner` |
| Pure domain logic | `domain/` (timezone, recurrence, reminder timing, RBAC, validation) |
| Delivery engine | `engine/dispatcher.ts` (storage-agnostic), `engine/prismaStore.ts`, `engine/scheduler.ts` |
| Channels | `channels/`: in-app and Web Push today; Email/WhatsApp/SMS/Teams stubs |
| Frontend | `client/src/modules/planner/` |

## How reminders flow

1. A task save calls `syncTaskReminders`. It upserts one `PlannerTaskNotification` row per recipient and instant. Each row has a unique `dedupeKey`, so the same reminder is never scheduled twice.
2. Every 30 s the scheduler does three things:
   - creates recurring instances for the next 48 h
   - queues company reminders
   - syncs meeting reminder tasks
3. It then hands due rows to the dispatcher. The dispatcher works in four steps:
   - It **claims** each row atomically (`SCHEDULED|FAILED → SENDING`), so several server instances never send the same reminder.
   - It re-checks DND, quiet hours, weekends, holidays and working hours at delivery time, and reschedules the row if it falls inside any of them.
   - It sends on the enabled channels. Channels that already succeeded are remembered, so a retry never duplicates them.
   - Transient failures retry with backoff (`RETRY_BACKOFF_MINUTES`) up to `maxDeliveryAttempts`. Rows stuck in `SENDING` for over 5 minutes are recovered.
4. Push payloads carry a short-lived **action token** bound to one reminder. With it, the service worker can complete, snooze or dismiss from the OS notification without a session (`POST /api/planner/reminders/action`).

## Adding a channel (Email, WhatsApp, SMS, Teams)

Implement `NotificationChannel` (`channels/types.ts`), then register it in `createDefaultChannels()`. Its `isConfigured()` should return `true` once credentials exist. Employee opt-in already lives in `PlannerNotificationPreference.channel*`.

## Operations

- Run `npm run prisma:db` once per environment. It creates the new collections and the unique `dedupeKey` index.
- `PLANNER_SCHEDULER_DISABLED=true` turns the scheduler off on an instance.
- `PLANNER_SCHEDULER_INTERVAL_MS` changes the tick interval (default 30000).
- Tests: `npm run test:planner` (server) and `npm run test:planner` (client). Both use `node:test` and need no extra dependencies.
