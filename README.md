# Ticket Watch Server

Plug-and-play local server for Ticket Watch.

For a real hosted server that Twilio can reach, use [DEPLOY_RENDER.md](DEPLOY_RENDER.md).

## Start

Open `start.command`, or run:

```bash
chmod +x start.command
./start.command
```

Then open:

```text
http://127.0.0.1:8790
```

## Chrome extension settings

In the extension popup, under `שרת מרכזי`:

- Enable: on
- Server URL: `http://127.0.0.1:8790`
- API Key: the value you typed into `start.command`
- Save server
- Test connection

The extension will send every booking it detects to the server.

## Twilio inbound

For local-only testing Twilio cannot reach `127.0.0.1`. To receive WhatsApp commands from Twilio you need to deploy this server or expose it with a tunnel.

When public, set Twilio's incoming message webhook to:

```text
https://YOUR-SERVER/twilio/inbound
```

Commands:

- `פתוח`
- `דחוף`
- `היום`
- `pnr 94YMAY`
- `help`

## Data

Bookings are stored in:

```text
data/ticket-watch-db.json
```
