# OpenNext Starter

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

Read the documentation at https://opennext.js.org/cloudflare.

## Develop

Run the Next.js development server:

```bash
npm run dev
# or similar package manager command
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Preview

Preview the application locally on the Cloudflare runtime:

```bash
npm run preview
# or similar package manager command
```

## Deploy

Deploy the application to Cloudflare:

```bash
npm run deploy
# or similar package manager command
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Book Section (PDF -> AI Questions)

- New UI route: `http://localhost:3000/book`
- Home page (`/`) дээрээс `Book Section` товчоор орно.

Backend URL-г заах бол:

```bash
NEXT_PUBLIC_BOOK_API_URL=http://localhost:4000
```

Энэ хувьсагчийг `frontend/.env.local` дотор нэмнэ.

### Bun-аар ажиллуулах

```bash
cd backend
cp .env.example .env
bun install
bun run dev
```

```bash
cd frontend
echo 'NEXT_PUBLIC_BOOK_API_URL=http://localhost:4000' > .env.local
bun install
bun run dev
```
