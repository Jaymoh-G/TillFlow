<?php

namespace App\Services;

use App\Models\Expense;
use App\Models\ExpenseRecurringRule;
use Carbon\CarbonImmutable;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class ExpenseRecurringGenerator
{
    /**
     * @return array{created: int, processed_rules: int}
     */
    public function run(?int $tenantId = null): array
    {
        $created = 0;
        $processed = 0;
        $now = now();

        $query = ExpenseRecurringRule::query()
            ->where('is_active', true)
            ->whereNotNull('next_run_at')
            ->where('next_run_at', '<=', $now)
            ->orderBy('id');

        if ($tenantId !== null) {
            $query->where('tenant_id', $tenantId);
        }

        /** @var Collection<int, ExpenseRecurringRule> $rules */
        $rules = $query->get();
        foreach ($rules as $rule) {
            $processed++;
            DB::transaction(function () use ($rule, $now, &$created): void {
                /** @var ExpenseRecurringRule|null $locked */
                $locked = ExpenseRecurringRule::query()
                    ->whereKey($rule->id)
                    ->lockForUpdate()
                    ->first();
                if (! $locked || ! $locked->is_active || ! $locked->next_run_at || $locked->next_run_at->gt($now)) {
                    return;
                }
                if ($locked->end_date && $locked->next_run_at->toDateString() > $locked->end_date->toDateString()) {
                    $locked->is_active = false;
                    $locked->save();

                    return;
                }

                $periodKey = $this->periodKey($locked, $locked->next_run_at);
                $already = Expense::query()
                    ->where('recurring_rule_id', $locked->id)
                    ->where('recurring_period_key', $periodKey)
                    ->exists();
                if (! $already) {
                    Expense::query()->create([
                        'tenant_id' => $locked->tenant_id,
                        'expense_date' => $locked->next_run_at->toDateString(),
                        'category_id' => $locked->category_id,
                        'customer_id' => $locked->customer_id,
                        'payee' => $locked->payee,
                        'title' => $locked->title,
                        'description' => $locked->description,
                        'amount' => $locked->amount,
                        'payment_mode' => $locked->payment_mode,
                        'payment_status' => $locked->payment_status,
                        'receipt_path' => null,
                        'notes' => $locked->notes,
                        'recurring_rule_id' => $locked->id,
                        'recurring_period_key' => $periodKey,
                        'created_by' => $locked->created_by,
                        'updated_by' => $locked->created_by,
                    ]);
                    $created++;
                }

                $locked->next_run_at = $this->nextRunAt($locked, $locked->next_run_at);
                if ($locked->end_date && $locked->next_run_at && $locked->next_run_at->toDateString() > $locked->end_date->toDateString()) {
                    $locked->is_active = false;
                }
                $locked->save();
            });
        }

        return ['created' => $created, 'processed_rules' => $processed];
    }

    private function periodKey(ExpenseRecurringRule $rule, Carbon $runAt): string
    {
        $d = CarbonImmutable::parse($runAt);

        return match ((string) $rule->cadence) {
            ExpenseRecurringRule::CADENCE_WEEKLY => $d->format('o-\WW'),
            ExpenseRecurringRule::CADENCE_MONTHLY => $d->format('Y-m'),
            default => $d->format('Y-m-d'),
        };
    }

    private function nextRunAt(ExpenseRecurringRule $rule, Carbon $runAt): Carbon
    {
        $interval = max(1, (int) ($rule->interval_value ?? 1));

        return match ((string) $rule->cadence) {
            ExpenseRecurringRule::CADENCE_WEEKLY => $runAt->copy()->addWeeks($interval),
            ExpenseRecurringRule::CADENCE_MONTHLY => $runAt->copy()->addMonthsNoOverflow($interval),
            default => $runAt->copy()->addDays($interval),
        };
    }
}
