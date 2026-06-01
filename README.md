# ESO Guild Gold Ledger

ESO Guild Gold Ledger is a live web app for tracking Elder Scrolls Online guild bank gold flow across one or more guilds, with secure accounts, shared guild access, and server-backed persistence.

## Live Site

- Website: `https://www.esoguildgoldledger.com`
- Render subdomain: `https://eso-guild-bank-management.onrender.com`

## Highlights

- Secure sign up and login backed by a Node and Express API
- Verified recovery email and password reset flow
- Server-side SQLite persistence instead of browser-only storage
- HTTP-only cookie sessions and hashed passwords with Node `crypto.scrypt`
- Guest mode for temporary drafting before account creation or login
- One-click import of legacy local browser data after login
- Multi-guild support with create, rename, delete, and select flows
- Shared guild access with owner-managed invite codes
- Invite options for expiration windows and single-use access
- Member leave flow and owner-only member removal
- Deposits, withdrawals, and sales tax entry tracking with notes
- Edit and delete support for existing entries
- Daily, weekly, monthly, and overall gold statistics
- Audit logging for important account and guild actions
- Automatic server-side backup snapshots

## Stack

- React + Vite frontend
- Material UI interface
- Node + Express API server
- SQLite database with `better-sqlite3`

## Local Development

Install dependencies:

```bash
npm install
```

Run the Vite frontend and API server together:

```bash
npm run dev
```

Build the frontend and run the production server locally:

```bash
npm run build
npm start
```

By default, the API server listens on `http://localhost:3001`.

## Deployment

The app is designed to run as a single Node service in production. The production server serves the built frontend from `dist/` and the API from the same process.

Typical production flow:

1. Run `npm install --include=dev`
2. Run `npm run build`
3. Set `NODE_ENV=production`
4. Set `DATABASE_FILE` to a persistent disk path
5. Set `PUBLIC_APP_URL` to your live canonical URL
6. Configure SMTP delivery for verification and password reset emails
7. Run `npm start`

For Render-style deployments with SQLite persistence, use a mounted disk path such as `/var/data/guild-bank.db`.

Recommended Render health check path:

- `/healthz`

## Environment Variables

- `PORT`: API and production web server port. Default: `3001`
- `DATABASE_FILE`: SQLite database path. Use a persistent disk path in production.
- `PUBLIC_APP_URL`: canonical public site URL. Default: `https://www.esoguildgoldledger.com`
- `SMTP_HOST`: SMTP host used for verification and password reset emails
- `SMTP_PORT`: SMTP port. Default: `587`
- `SMTP_SECURE`: set to `true` for implicit TLS SMTP transports such as port `465`
- `SMTP_USER`: SMTP username
- `SMTP_PASS`: SMTP password
- `SMTP_FROM_EMAIL`: sender email address shown on verification and reset messages
- `SMTP_FROM_NAME`: optional sender name. Default: `ESO Guild Gold Ledger`
- `EMAIL_VERIFICATION_TOKEN_TTL_HOURS`: verification link lifetime in hours. Default: `24`
- `PASSWORD_RESET_TOKEN_TTL_MINUTES`: password reset link lifetime in minutes. Default: `60`
- `SESSION_COOKIE_NAME`: optional session cookie name override
- `SESSION_TTL_DAYS`: session lifetime in days. Default: `14`

For local testing without a real SMTP provider, you can set `MAIL_CAPTURE_DIRECTORY` to write outgoing email payloads to disk instead of sending them.

## Post-Deploy Checklist

1. Confirm the Render health check path is set to `/healthz`
2. Set `PUBLIC_APP_URL` to `https://www.esoguildgoldledger.com`
3. Configure SMTP environment variables before opening public signups
4. Submit `https://www.esoguildgoldledger.com/` and `https://www.esoguildgoldledger.com/sitemap.xml` in Google Search Console
5. Smoke-test sign up, email verification, password reset, guild creation, and shared-guild invite flows on the live domain

## Validation

```bash
npm test
npm run build
```
