# Getting started

## 1. Create the Discord application

1. Open the [Discord Developer Portal](https://discord.com/developers/applications) and create an application.
2. Under **Bot**, reset and copy the token. This is `DISCORD_TOKEN`. Never commit it.
3. Under **General Information**, copy the Application ID. This is `DISCORD_CLIENT_ID`.
4. Rupa only uses the `Guilds` intent out of the box, so you do not need to enable any privileged intent.

## 2. Install

```bash
git clone https://github.com/MasRama/rupa.git my-bot
cd my-bot
npm install
cp .env.example .env
```

Fill in `.env`:

```env
DISCORD_TOKEN=...
DISCORD_CLIENT_ID=...
# Your test server: commands deploy there instantly
DISCORD_GUILD_ID=...
```

To get `DISCORD_GUILD_ID`, enable Developer Mode in Discord (Settings → Advanced), then right-click your server and choose **Copy Server ID**.

## 3. Invite the bot

Open this URL with your application id filled in:

```
https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&scope=bot+applications.commands&permissions=1099511720966
```

The permission number covers View Channels, Send Messages, Embed Links, Read Message History, Kick Members, Ban Members, Manage Messages and Moderate Members, which is what the example features use. Adjust it to match your own features.

## 4. Register commands and run

```bash
npm run deploy:plan   # see what would be registered
npm run deploy        # register it
npm run dev           # start the bot, reloading on save
```

Type `/help` in your server.

## 5. Make it yours

- Remove the example features you do not want from `src/app/features.ts` and delete their folders.
- Scaffold your own with `npm run rupa -- make feature tickets`, and read [features.md](./features.md).
- Run `npm run deploy` again whenever commands change.

## Running in production

```bash
npm ci
npm run build
NODE_ENV=production npm start
```

With `NODE_ENV=production`, logs are JSON lines (pino) instead of pretty output. Migrations run on every start before the bot logs in, so a deploy only needs the new build and a restart. For global commands, unset `DISCORD_GUILD_ID` and run `npm run deploy`. Global changes can take a while to reach every client.

Use any process manager (systemd, pm2, Docker). The database is the single file at `DATABASE_PATH`, so back that file up.
