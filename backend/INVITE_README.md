# Invite & Request Access - Testing

This file explains how to test the newly added invite and access-request flows.

## Endpoints

- POST /api/access-requests
  - body: { name, email, company }
  - creates an AccessRequest row; admin should be notified (not implemented) but the request is stored.

- POST /api/invite/accept
  - body: { token, password }
  - consumes Invitation and returns an object with jwt, refreshToken and user on success.

- GET /api/invite/status?token=... (if implemented) - validate token

## Local test steps

1. Apply Prisma migrations (from `backend`):

```powershell
cd backend
npx prisma migrate dev --name add_access_invitation
# or if you prefer db push for quick test
npx prisma db push
```

2. Start the backend:

```powershell
# from backend
npm run dev
```

3. Create an access request (from the mobile app or curl):

```powershell
curl -X POST http://localhost:4000/api/access-requests -H "Content-Type: application/json" -d "{ \"name\": \"Mario Rossi\", \"email\": \"mario@example.com\", \"company\": \"ACME\" }"
```

4. Create an invitation via the admin panel (POST /api/users without `password`) or via the DB seed. The backend will write an invite entry to `backend/logs/mail.log` for debugging purposes; this log previously included deep-links and web fallback URLs for convenience.

5. For security and privacy, email messages no longer include clickable deep-links or web URLs. Instead, invited users receive a token and clear instructions. To accept an invite, follow these steps:
  - Open the Gestionexus app on your device.
  - Go to the Login screen and select the 'Accept Invite' or 'Reset/Accept' option (if present).
  - Paste the token from the invite email into the token field and proceed to set your password.

  If you administer the system and need to test invites locally, inspect `backend/logs/mail.log` to view the generated token (dev only). Do not share tokens over insecure channels in production.

6. Accept the invite by setting a password in the app. On success you'll be logged in.

## Notes

- Mail sending uses `mailer` abstraction; invites are still emailed when SMTP is configured. In dev mode you'll find invite links in `backend/logs/mail.log`.
- First admin bootstrap: consider running a seed script to create the first admin user if no users exist. This is not implemented automatically.
