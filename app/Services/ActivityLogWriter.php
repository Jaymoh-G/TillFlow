<?php

namespace App\Services;

use App\Jobs\RecordActivityLogJob;
use App\Models\Invoice;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

class ActivityLogWriter
{
    /**
     * @param  array<string, mixed>  $properties  Must be JSON-serializable (queue payload).
     */
    public function record(
        Tenant $tenant,
        ?User $user,
        string $action,
        ?Model $subject,
        array $properties = [],
        ?Request $request = null
    ): void {
        if (! config('activity_log.enabled', true)) {
            return;
        }

        $allowed = config('activity_log.record_actions', []);
        if (is_array($allowed) && $allowed !== [] && ! in_array($action, $allowed, true)) {
            return;
        }

        if (! config('activity_log.dual_subject_invoice_and_payment', true)) {
            if ($subject instanceof Invoice && str_starts_with($action, 'invoice_payment.')) {
                return;
            }
        }

        $subjectKey = $subject?->getKey();
        $subjectId = $subjectKey !== null && is_numeric($subjectKey) ? (int) $subjectKey : null;

        RecordActivityLogJob::dispatch(
            $tenant->id,
            $user?->id,
            $action,
            $subject !== null ? $subject->getMorphClass() : null,
            $subjectId,
            $properties === [] ? null : $properties,
            $request?->ip(),
            now()->toIso8601String(),
        );
    }
}
