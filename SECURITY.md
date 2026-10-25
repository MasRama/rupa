# Security policy

## Supported versions

Rupa is pre-1.0. Security fixes go into the latest minor release only.

| Version | Supported |
| --- | --- |
| latest 0.x | yes |
| older | no |

## Reporting a vulnerability

Please do **not** open a public issue.

Report it privately through GitHub: open the repository's **Security** tab and choose **Report a vulnerability**. Include what you found, how to reproduce it, and the impact you expect.

You can expect an acknowledgement within a few days. Once the issue is confirmed, a fix and a release follow, and you are credited in the advisory unless you prefer otherwise.

## Keeping your bot safe

- Never commit `.env` or a bot token. If a token leaks, reset it in the Developer Portal right away.
- Give the bot only the permissions and intents its features need.
- Treat everything users type (options, modal fields, message content) as untrusted. Use parameterized SQL (`db.prepare(...).run(value)`), as the example features do.
