# Backend React Frontend

This React app is dedicated to `book-question-backend`.

## Run

```bash
cd backend/frontend-react
bun install
bun run dev
```

Default URL: `http://127.0.0.1:5173`

By default it uses Vite proxy to call backend at `http://127.0.0.1:4000`.
If the backend starts on another port (because `4000` is busy), the backend writes its
actual port to `backend/.backend-port`, and Vite will use that automatically (restart Vite if needed).
If your backend uses another URL, create `.env`:

```bash
VITE_BOOK_API_URL=http://127.0.0.1:4000
```

Alternative (for Vite proxy target):

```bash
VITE_BACKEND_URL=http://127.0.0.1:4000
```
