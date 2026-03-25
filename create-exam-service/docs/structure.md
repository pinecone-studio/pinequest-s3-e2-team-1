# create-exam-service — бүтэц

## Сервер

Энэ төсөл **Apollo Server биш**, **GraphQL Yoga** (`/api/graphql`) ашиглана. Yoga нь GraphQL HTTP endpoint өгдөг; frontend **Apollo Client**-ээр холбогдоно — нэр төстэй боловч backend дээр Apollo Server суулгах шаардлагагүй.

## Хавтасууд

| Хавтас / файл | Зориулалт |
|---------------|-----------|
| `src/app/api/graphql/route.ts` | Yoga handler (`GET`/`POST`/`OPTIONS`) |
| `src/graphql/schema.graphql` | **Schema-first** эх (codegen эндээс уншина) |
| `src/graphql/typeDefs.ts` | Yoga-д өгөх `typeDefs` string (`schema.graphql`-тай синхрон байлгах) |
| `src/graphql/schema.ts` | `createSchema({ typeDefs, resolvers })` |
| `src/graphql/context.ts` | `GraphQLContext` — D1, `GEMINI_API_KEY` |
| `src/graphql/types.ts` | Resolver-д ашиглах TS төрлүүд (зарим input) |
| `src/graphql/resolvers/queries/` | Query resolver-ууд (`health` гэх мэт) |
| `src/graphql/resolvers/mutations/` | Mutation resolver-ууд (файл тус бүр: нэг mutation) |
| `src/graphql/resolvers/index.ts` | `Query` + `Mutation` нэгтгэх |
| `src/graphql/generated/` | `graphql-codegen` гаргах (resolver types) — git-д оруулж болно |
| `src/lib/ai.ts` | Gemini — асуулт үүсгэх |
| `src/db/schema.ts` | Drizzle: бүх хүснэгтийг `schema/tables/`-аас re-export |
| `src/db/schema/tables/` | Хүснэгт бүр тусдаа файл (`exams.ts`, …) |
| `src/db/index.ts` | `getDb(d1)` |
| `drizzle/` | `drizzle-kit generate`-ийн SQL migration-ууд |
| `drizzle.config.ts` | `drizzle-kit` тохиргоо (D1 remote) |
| `codegen.ts` | Backend codegen (`typescript-resolvers`) |

## Drizzle: хаана бичих вэ

1. Шинэ хүснэгт: `src/db/schema/tables/<нэр>.ts` дотор `sqliteTable(...)` тодорхойлно.
2. `src/db/schema/index.ts` дотор `export * from "./tables/<нэр>"` нэмнэ.
3. `src/db/schema.ts` нь зөвхөн `export * from "./schema/index"` — ихэвчлэн өөрчлөх шаардлагагүй.

**Remote D1 дээр migration:**

```bash
cd create-exam-service
# .env: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_DATABASE_ID, CLOUDFLARE_D1_TOKEN
bun run db:generate
bunx wrangler d1 migrations apply <database_name> --remote
```

Локал ашиглавал Wrangler-ийн заавартай `d1 migrations apply --local`.

## GraphQL codegen

| Төсөл | Файл | Үр дүн |
|-------|------|--------|
| Backend | `codegen.ts` | `src/graphql/generated/resolvers-types.ts` — resolver-ийн `Resolvers` type |
| Frontend | `frontend/codegen.ts` | `src/gql/` — Apollo/React-д `gql` + typed documents |

Ажиллуулах: тухайн package.json доторх `codegen` script.

## Шинэ mutation/query нэмэх

1. `schema.graphql` + `typeDefs.ts` дээр тодорхойлолт нэмнэ.
2. `resolvers/mutations/<нэр>.ts` эсвэл `resolvers/queries/<нэр>.ts` үүсгэж, `index.ts`-д spread/import нэмнэ.
3. `bun run codegen` (backend) ажиллуулж төрөл шинэчилнэ.
