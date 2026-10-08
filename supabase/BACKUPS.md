# Backups

`.github/workflows/backup.yml` runs every day:

- **Daily** — one tiny query, so the free Supabase project keeps seeing activity and is less likely to be paused.
- **Every Sunday** (or when run by hand) — a full copy of the database (all tables, security rules and data), encrypted with your passphrase and kept under **Actions → Database backup → (run) → Artifacts** for 90 days, so you always have ~12 weekly copies.

The repo is public, so backups are encrypted (AES-256). Without the passphrase the file is useless to anyone else. **Keep the passphrase in your password manager — if it's lost, the backups can't be opened.**

## Secrets it needs (Settings → Secrets and variables → Actions)

| Name | Value |
| --- | --- |
| `SUPABASE_DB_URL` | Supabase → **Connect** → **Session pooler** connection string, with `[YOUR-PASSWORD]` replaced by your database password. (Use the *session pooler* one — GitHub's servers can't reach the direct connection.) |
| `BACKUP_PASSPHRASE` | A long passphrase you choose. |

## Take a backup now

Actions → **Database backup** → **Run workflow**.

## Open a backup

Download the artifact (a .zip), unzip it, then on a Mac:

```bash
brew install gnupg            # once
gpg --decrypt huemen-backup-YYYY-MM-DD.tgz.gpg > backup.tgz   # asks for the passphrase
tar xzf backup.tgz            # → huemen.sql + counts.txt
```

## Restore

Restoring replaces live data, so do it deliberately (ask Claude to help):

1. In a **new** Supabase project, run `huemen.sql` in the SQL Editor (or `psql "<connection string>" -f huemen.sql`).
2. Create your login in Authentication → Users, then update `user_id` on every table to the new user's id.
3. Point `src/config.ts` at the new project's URL and publishable key and push.
