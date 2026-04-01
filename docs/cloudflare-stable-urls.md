# Cloudflare Stable URLs

Одоогийн байдлаар custom domain байхгүй тул stable production URL-уудыг `workers.dev` дээр тогтвортой ашиглана.

Official docs:
- https://developers.cloudflare.com/workers/wrangler/configuration/
- https://developers.cloudflare.com/workers/wrangler/environments/
- https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
- https://developers.cloudflare.com/workers/configuration/routing/workers-dev/

## Current stable URLs

- `frontend`: `https://frontend.tsetsegulziiocherdene.workers.dev`
- `take-exam-service`: `https://take-exam-service.tsetsegulziiocherdene.workers.dev`
- `take-exam-service GraphQL`: `https://take-exam-service.tsetsegulziiocherdene.workers.dev/api/graphql`

## Current deploy rule

- `preview` URL бүү ашигла.
- `deploy` ашигла.
- Worker `name`-ээ бүү соль.
- `workers_dev: true` хэвээр байлгана.

## Deploy flow

1. `frontend` болон `take-exam-service`-ээ `deploy` хийнэ.
2. `frontend`-ийн env дээр `take-exam-service`-ийн `workers.dev` GraphQL URL-ийг заана.
3. Хэрэв remote `create-exam-service` ашиглаж байвал мөн `workers.dev` URL-ийг нь заана.
4. Ollama-г deployed дээр ашиглах бол `OLLAMA_BASE_URL` нь заавал remote reachable URL байна.

## Commands

Frontend deploy:

```bash
cd frontend
npm run deploy
```

Take-exam-service deploy:

```bash
cd take-exam-service
npm run deploy
```

## Frontend vars

- `TAKE_EXAM_GRAPHQL_URL=https://take-exam-service.tsetsegulziiocherdene.workers.dev/api/graphql`
- `NEXT_PUBLIC_TAKE_EXAM_GRAPHQL_URL=https://take-exam-service.tsetsegulziiocherdene.workers.dev/api/graphql`
- `NEXT_PUBLIC_CREATE_EXAM_GRAPHQL_URL=https://create-exam-service.tsetsegulziiocherdene.workers.dev/api/graphql`
- `OLLAMA_BASE_URL=https://fax-guides-draw-minority.trycloudflare.com`
- `OLLAMA_MODEL=llama3.1:latest`

## Take-exam-service vars

- `CREATE_EXAM_SERVICE_GRAPHQL_URL=https://create-exam-service.tsetsegulziiocherdene.workers.dev/api/graphql`
- `OLLAMA_BASE_URL=https://fax-guides-draw-minority.trycloudflare.com`
- `OLLAMA_MODEL=llama3.1:latest`

## Quick copy-paste env

Frontend:

```env
TAKE_EXAM_GRAPHQL_URL=https://take-exam-service.tsetsegulziiocherdene.workers.dev/api/graphql
NEXT_PUBLIC_TAKE_EXAM_GRAPHQL_URL=https://take-exam-service.tsetsegulziiocherdene.workers.dev/api/graphql
NEXT_PUBLIC_CREATE_EXAM_GRAPHQL_URL=https://create-exam-service.tsetsegulziiocherdene.workers.dev/api/graphql
OLLAMA_BASE_URL=https://fax-guides-draw-minority.trycloudflare.com
OLLAMA_MODEL=llama3.1:latest
```

Take-exam-service:

```env
CREATE_EXAM_SERVICE_GRAPHQL_URL=https://create-exam-service.tsetsegulziiocherdene.workers.dev/api/graphql
OLLAMA_BASE_URL=https://fax-guides-draw-minority.trycloudflare.com
OLLAMA_MODEL=llama3.1:latest
```

## Important notes

- `workers.dev` URL нь stable, харин `preview` URL stable биш.
- `frontend.tsetsegulziiocherdene.workers.dev` deployed орчноос local `localhost` дээрх Ollama руу хүрэхгүй.
- Тиймээс deployed Ollama ашиглах бол `OLLAMA_BASE_URL` нь remote reachable host байна.
- `https://fax-guides-draw-minority.trycloudflare.com` нь одоогийн working URL, гэхдээ `trycloudflare` tunnel URL ихэвчлэн түр байдаг.
- Хэрэв remote Ollama байхгүй бол deployed үед fallback эсвэл Gemini ашиглагдана.
- Дараа нь custom domain авбал `workers.dev`-ээс custom domain руу шилжиж болно.
