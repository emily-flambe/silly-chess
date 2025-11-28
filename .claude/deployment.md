# Deployment

## Quick Reference

```bash
# Development
npm run dev                    # Start local dev server (port 8787)

# Deploy to Cloudflare
npm run deploy                 # Deploy worker + assets

# Database
npm run db:migrate:local       # Apply schema to local D1
npm run db:migrate             # Apply schema to remote D1 (requires --remote flag manually)
```

## URLs

| Environment | URL |
|-------------|-----|
| Production | https://chess.emilycogsdill.com |
| Workers.dev | https://silly-chess.emily-cogsdill.workers.dev |
| Local Dev | http://localhost:8787 |

## Cloudflare Resources

| Resource | Name/ID |
|----------|---------|
| Worker | `silly-chess` |
| D1 Database | `silly-chess-db` (`ffad9c57-6375-4161-b5fc-fccf2e534dbd`) |
| Custom Domain | `chess.emilycogsdill.com` |

## Deployment Steps

### 1. Local Development
```bash
cd /Users/emilycogsdill/Documents/GitHub/silly-chess
npm run dev
```

### 2. Deploy to Production
```bash
npm run deploy
```

This uploads:
- Worker code (src/index.ts)
- Static assets (dist/)
- Binds D1 database
- Routes to custom domain

### 3. Database Schema Changes

Apply locally first:
```bash
wrangler d1 execute silly-chess-db --local --file=./src/db/schema.sql
```

Apply to production:
```bash
wrangler d1 execute silly-chess-db --remote --file=./src/db/schema.sql
```

## Wrangler Configuration

```toml
# wrangler.toml
name = "silly-chess"
main = "src/index.ts"
compatibility_date = "2025-01-15"

routes = [
  { pattern = "chess.emilycogsdill.com/*", zone_name = "emilycogsdill.com" }
]

[assets]
directory = "./dist"
not_found_handling = "single-page-application"

[[d1_databases]]
binding = "DB"
database_name = "silly-chess-db"
database_id = "ffad9c57-6375-4161-b5fc-fccf2e534dbd"
```

## Frontend Build

The frontend needs to be bundled with Vite before deployment:

```bash
npm run build    # Builds to dist/
```

Currently, the dist/ folder contains a placeholder. Full frontend bundling requires:
1. Configure Vite to bundle src/frontend/
2. Handle TypeScript imports for components
3. Output to dist/ for Cloudflare Assets

## Troubleshooting

### Worker not updating
```bash
wrangler deployments list --name silly-chess
```

### D1 connection issues
```bash
wrangler d1 info silly-chess-db
```

### View logs
```bash
wrangler tail silly-chess
```

### Check route assignment
Routes are managed in wrangler.toml. If conflicts occur:
1. Visit Cloudflare Dashboard > Workers & Pages
2. Check route assignments
3. Unassign conflicting workers
