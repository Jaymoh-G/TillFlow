# Laravel scheduler (automation)

TillFlow runs invoice and document reminder automation via `php artisan automation:run`, which is registered in `bootstrap/app.php` to execute **every minute** when the OS scheduler invokes Laravel.

## Required: run `schedule:run` every minute

### Linux / macOS (cron)

Add a crontab entry (adjust the PHP and project paths):

```cron
* * * * * cd /path/to/backend && php artisan schedule:run >> /dev/null 2>&1
```

### Windows (Task Scheduler)

1. Open **Task Scheduler** → **Create Basic Task**.
2. Trigger: **Daily**, then set repetition to **every 1 minute** (advanced) or use multiple triggers as needed.
3. Action: **Start a program**  
   - Program: `C:\path\to\php.exe`  
   - Arguments: `artisan schedule:run`  
   - Start in: `C:\path\to\backend`  
   (Replace with your PHP executable and Laravel `backend` folder.)

### Development

You can run the scheduler loop locally without cron:

```bash
php artisan schedule:work
```

This keeps processing scheduled tasks in the foreground.

## What runs

- `automation:run` — sends due/overdue invoice reminders and quotation/proposal expiry reminders according to each tenant’s **Settings → Automation** and **hour/timezone** configuration.

Ensure mail (`.env` `MAIL_*`) and SMS gateway credentials (saved under **Settings → SMS gateways** and synced to the tenant) are valid for production sends.
