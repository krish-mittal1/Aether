# Architecture Notes

The system is split into four runtime roles:

- `frontend`: Next.js App Router UI with Monaco and Socket.IO client.
- `backend`: FastAPI REST API plus Socket.IO ASGI app.
- `postgres`: durable relational state for users, rooms, files, and chat.
- `redis`: low-latency presence and socket session cache.
- `executor`: isolated code runner for Python, JavaScript, and C++.

Collaboration currently uses last-write-wins file synchronization. This keeps the implementation simple and working end-to-end. The code path is intentionally modular so a CRDT layer can replace raw `code_change` payloads later.
