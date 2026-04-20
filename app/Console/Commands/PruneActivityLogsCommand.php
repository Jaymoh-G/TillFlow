<?php

namespace App\Console\Commands;

use App\Models\ActivityLog;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;

class PruneActivityLogsCommand extends Command
{
    protected $signature = 'activity-logs:prune
                            {--days= : Delete rows older than this many days (defaults to config activity_log.retention_days)}';

    protected $description = 'Delete activity log rows older than the retention window (chunked).';

    public function handle(): int
    {
        $days = $this->option('days');
        $retentionDays = $days !== null && $days !== ''
            ? max(1, (int) $days)
            : max(1, (int) config('activity_log.retention_days', 730));

        $chunk = max(100, (int) config('activity_log.prune_chunk', 1000));
        $cutoff = CarbonImmutable::now()->subDays($retentionDays);

        $total = 0;
        do {
            $deleted = ActivityLog::query()
                ->where('created_at', '<', $cutoff)
                ->orderBy('id')
                ->limit($chunk)
                ->delete();

            $total += $deleted;
        } while ($deleted > 0);

        $this->info("Pruned {$total} activity log row(s) older than {$retentionDays} day(s) (cutoff {$cutoff->toDateTimeString()}).");

        return self::SUCCESS;
    }
}
