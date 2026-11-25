# SuperX_RobRunPatchNotes v1.0.0

Automatically posts **ROB RUN** (Steam app 4262460, by Kefir) patch notes to Discord, in the SuperX lime green + black style.

This version runs for free on **GitHub Actions**, so there's nothing to install and your PC doesn't need to be on. Every 15 minutes GitHub checks Steam and posts any new patch notes through a Discord webhook.

## Settings

All in the repository's **Settings → Secrets and variables → Actions**:

| Name | Where | What |
|---|---|---|
| `DISCORD_WEBHOOK_URL` | **Secrets** tab | Webhook link for channel 1: Chill Zone #rob-run-patch-notes (required) |
| `DISCORD_WEBHOOK_URL_2` | **Secrets** tab | Webhook link for channel 2: Goliad Se Grot #🔥robrun-updates |
| `DISCORD_WEBHOOK_URL_3` to `_5` | **Secrets** tab | Optional extra channels |
| `ROLE_ID` | **Variables** tab | A role ID to ping (optional; leave it out for no ping) |

Other options (game, filter, embed text, webhook name and avatar) are in `config.js`.

## Run it now / post again

Go to the **Actions** tab → **SuperX_RobRunPatchNotes** → **Run workflow**.
Tick **Post the newest patch notes again** to repost the latest one. Use **Post to** to send it to all channels or just one (1 = Chill Zone, 2 = Goliad Se Grot).

## Add a role ping later

1. In Discord, turn on Developer Mode, then right-click the role → **Copy Role ID**
2. In GitHub: Settings → Secrets and variables → Actions → **Variables** → **New repository variable**
3. Name: `ROLE_ID`, Value: the role ID

## Notes

- GitHub's timer isn't exact, so a post can take 15 minutes to about an hour to show up.
- `state.json` remembers which posts were already sent, so nothing posts twice. Don't delete it (if you do, it marks old posts as seen again and only posts the newest).
- The workflow updates `state.json` at least once a week, so GitHub doesn't pause the schedule on a quiet repo.
- Keep the webhook link secret. Anyone who has it can post in that channel.
