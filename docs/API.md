# Expedition API

`POST /api/expeditions` accepts JSON containing string `dwarfId` and `destination`. A successful response contains an expedition id, `completed` status, a partial resource reward, and a narrative message. Invalid input returns 400, an unknown destination returns 404, and `blocked-pass` or `?fail=true` returns 503. Destinations `crystal-cave`, `old-mine`, and `howling-depths` have rewards.

The deterministic result arrives after a configurable delay and there is no polling or server-side persisted task. Restarting the server resets expedition numbering. During Vite development, `/api` is proxied to port 4200.
