# Deploy Ticket Watch Server on Render

This is the easiest hosted setup for a non-developer workflow.

## What you get

- Public dashboard URL, for example `https://ticket-watch-server.onrender.com`
- Chrome extension syncs bookings to that URL
- Twilio can call the public inbound webhook
- Data persists on a small Render disk

## Step 1: Put this folder on GitHub

Create a GitHub repo containing the files from `ticket-watch-server`.

The important files are:

- `server.mjs`
- `package.json`
- `render.yaml`

## Step 2: Create the Render service

1. Open Render.
2. Choose New > Blueprint.
3. Connect the GitHub repo.
4. Render reads `render.yaml`.
5. Fill the secret environment variables.

Render's Node guide says a Node web service can be created from a repo and needs a start command such as `node app.js` or your own `npm start`. This project uses `npm start`.

## Step 3: Environment variables

Use these:

```text
TICKET_WATCH_API_KEY=choose-a-long-secret
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM=whatsapp:+19513642155
TWILIO_TO=whatsapp:+972...
TWILIO_CONTENT_SID=HX...
```

Already handled by `render.yaml`:

```text
HOST=0.0.0.0
DATA_DIR=/var/data
```

## Step 4: Verify

Open:

```text
https://YOUR-RENDER-URL/health
```

Expected:

```json
{"ok":true}
```

Dashboard:

```text
https://YOUR-RENDER-URL/
```

## Step 5: Connect the Chrome extension

In the extension popup, under `שרת מרכזי`:

- Enable: on
- Server URL: `https://YOUR-RENDER-URL`
- API Key: same value as `TICKET_WATCH_API_KEY`
- Save server
- Test connection

## Step 6: Connect Twilio inbound WhatsApp

In Twilio's WhatsApp sender settings, set incoming message webhook to:

```text
https://YOUR-RENDER-URL/twilio/inbound
```

Then you can send WhatsApp commands:

- `פתוח`
- `דחוף`
- `היום`
- `pnr 94YMAY`
- `help`

## Notes

- Keep `TWILIO_AUTH_TOKEN` out of the Chrome extension.
- The extension only sends booking data to the server.
- Twilio secrets live only on Render.
