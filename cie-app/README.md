# vinext app

This project was created with create-vinext-app.

## Scripts

- `pnpm run dev` starts the vinext dev server.
- `pnpm run build` builds the Cloudflare Worker output.
- `pnpm run start` starts the built Worker locally with Wrangler.
- `pnpm run deploy` deploys the Cloudflare Worker.

## Local database

The app uses a Cloudflare D1 binding named `DB`. In local development, D1 is
backed by a SQLite file managed by Wrangler under `.wrangler/state`.

Apply the migrations before first use:

```sh
npm run db:migrate
```

Use the database in server-only code:

```ts
import { getDatabase } from "@/lib/db/database";

const roles = await getDatabase()
  .prepare("SELECT * FROM roles ORDER BY created_at DESC")
  .all();
```

Run an ad-hoc local query:

```sh
npm run db:query -- "SELECT * FROM roles"
```
