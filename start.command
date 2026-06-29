#!/bin/zsh
cd "$(dirname "$0")" || exit 1

echo "Ticket Watch Server"
echo
echo "This keeps your secrets only in this terminal session."
echo "Leave this window open while using the server."
echo

read "TICKET_WATCH_API_KEY?Choose API key for the Chrome extension: "
read "TWILIO_ACCOUNT_SID?Twilio Account SID: "
read -s "TWILIO_AUTH_TOKEN?Twilio Auth Token: "
echo
read "TWILIO_FROM?Twilio From (example whatsapp:+19513642155): "
read "TWILIO_TO?Twilio To (example whatsapp:+972...): "
read "TWILIO_CONTENT_SID?Twilio Content SID (HX...): "

export TICKET_WATCH_API_KEY
export TWILIO_ACCOUNT_SID
export TWILIO_AUTH_TOKEN
export TWILIO_FROM
export TWILIO_TO
export TWILIO_CONTENT_SID

echo
echo "Starting at http://127.0.0.1:8790"
echo

node server.mjs
