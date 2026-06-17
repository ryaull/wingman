# 🐦 Wingman

A Chrome extension that reads your open chat and suggests replies based on what you're going for — casual, flirty, formal, or reviving a dying conversation. Pick a vibe (or type your own goal), and it generates reply options you can insert with one click.

## What it does
- Reads the conversation in your open chat tab
- Suggests replies tuned to your chosen goal
- Draggable, tuck-away panel that stays out of your way
- Click a suggestion to insert it, or copy it
- Nothing is stored — your chats never leave the browser

## Built with
JavaScript, Chrome Extension APIs, Groq (Llama 3.3)

## Setup
1. Load the folder via `chrome://extensions` → Developer mode → Load unpacked
2. Add your free Groq API key (get one at console.groq.com/keys)
3. Open a chat and hit the floating button

## Note
A personal project / proof of concept. Reads only what's on screen; designed as a reply *assistant*, not an auto-sender.