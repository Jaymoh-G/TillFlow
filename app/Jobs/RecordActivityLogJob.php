<?php

namespace App\Jobs;

use App\Models\ActivityLog;
use Carbon\CarbonImmutable;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Log;
use Throwable;

class RecordActivityLogJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;

    public int $tries = 3;

    /**
     * @param  array<string, mixed>|null  $properties  JSON-serializable only
     */
    public function __construct(
        public int $tenantId,
        public ?int $userId,
        public string $action,
        public ?string $subjectType,
        public ?int $subjectId,
        public ?array $properties,
        public ?string $ipAddress,
        public string $createdAtIso,
    ) {}

    /**
     * @return list<int>
     */
    public function backoff(): array
    {
        return [10, 60, 300];
    }

    public function handle(): void
    {
        ActivityLog::query()->create([
            'tenant_id' => $this->tenantId,
            'user_id' => $this->userId,
            'action' => $this->action,
            'subject_type' => $this->subjectType,
            'subject_id' => $this->subjectId,
            'properties' => $this->properties,
            'ip_address' => $this->ipAddress,
            'created_at' => CarbonImmutable::parse($this->createdAtIso),
        ]);

        SendActivityPushNotificationsJob::dispatch(
            $this->tenantId,
            $this->action,
            $this->properties,
        );
    }

    public function failed(?Throwable $exception): void
    {
        Log::warning('Activity log job failed after retries.', [
            'action' => $this->action,
            'tenant_id' => $this->tenantId,
            'error' => $exception?->getMessage(),
        ]);
    }
}
