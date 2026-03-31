# pinequest-s3-e2-team-1

## Book Upload -> AI Question Flow

This repository now includes:

- `backend/`: Node.js + Express API for PDF upload, page-range selection, and Ollama question generation
- `frontend/`: Next.js UI with new `/book` page for upload + 20 question generation

### Run locally

1. Start backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

2. Start frontend

```bash
cd frontend
npm install
echo 'NEXT_PUBLIC_BOOK_API_URL=http://localhost:4000' > .env.local
npm run dev
```

3. Open

- `http://localhost:3000/book`
