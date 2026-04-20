# Backups and restore

## Full backups (Spatie Laravel Backup)

Scheduled in `bootstrap/app.php` when `BACKUP_ENABLED` is true (default):

- `backup:run` — daily at 01:15
- `backup:clean` — daily at 01:45 (removes archives older than ~60 days by default)
- `backup:monitor` — daily at 04:00

**Server requirement:** the host must run `php artisan schedule:run` every minute (cron).

**Contents:** MySQL dump plus `storage/app/public` (uploads), with backup/temp/cache paths excluded. Application code is deployed from Git; do not expect PHP/JS sources inside the zip.

**Destinations:** local disk `backups` (`storage/app/backups`) and optionally S3-compatible storage when `BACKUP_WRITE_S3=true`.

**Configuration:** see `config/backup.php` and environment variables prefixed with `BACKUP_` in `.env.example`.

**Tracing:** rows are written to `backup_events` when Spatie events fire (success/failure/cleanup/unhealthy).

## Per-tenant export / import

Artisan commands:

- `php artisan tenant:backup-export {tenantId}` — creates `storage/app/tenant-exports/tenant-{id}-{timestamp}.zip` with `data.sql`, `files/`, `manifest.json`, and records `backup_events`.
- `php artisan tenant:backup-import {path}` — imports `data.sql` and copies `files/` into `storage/app/public`. Use on **staging** or an **empty** database; merging into a live production DB is risky.

Optional **email** to tenants: set `TENANT_BACKUP_EMAIL_ENABLED=true` and per-tenant `ui_settings`:

```json
{
  "backup_email": {
    "enabled": true,
    "to": "admin@example.com"
  }
}
```

Schedule: `tenant:backup-email` weekly (Monday 06:00) when email is enabled.

## Restore (full)

1. Unzip the Spatie archive.
2. Import the `.sql` file into MySQL.
3. Restore `storage/app/public` from the zip (paths under `storage/` in the archive).
4. Deploy application code from Git / CI.
5. Run `php artisan migrate --force` if needed and `php artisan storage:link` on a fresh server.
