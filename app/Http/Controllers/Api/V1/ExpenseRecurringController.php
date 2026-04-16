<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Expense;
use App\Models\ExpenseRecurringRule;
use App\Models\Tenant;
use App\Services\ExpenseRecurringGenerator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ExpenseRecurringController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        $rows = ExpenseRecurringRule::query()
            ->where('tenant_id', $tenant->id)
            ->with(['category', 'customer'])
            ->orderByDesc('id')
            ->get();

        return response()->json(['message' => 'Recurring expense rules retrieved.', 'rules' => $rows]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        $validated = $this->validatePayload($request, $tenant, null);

        $row = ExpenseRecurringRule::query()->create([
            'tenant_id' => $tenant->id,
            'category_id' => $validated['category_id'] ?? null,
            'customer_id' => $validated['customer_id'] ?? null,
            'title' => trim((string) $validated['title']),
            'description' => $this->normalizeText($validated['description'] ?? null),
            'payee' => $this->normalizeText($validated['payee'] ?? null),
            'amount' => number_format((float) $validated['amount'], 2, '.', ''),
            'payment_mode' => $validated['payment_mode'] ?? Expense::PAYMENT_MODE_CASH,
            'payment_status' => $validated['payment_status'] ?? Expense::PAYMENT_STATUS_UNPAID,
            'notes' => $this->normalizeText($validated['notes'] ?? null),
            'cadence' => $validated['cadence'],
            'interval_value' => (int) ($validated['interval_value'] ?? 1),
            'start_date' => $validated['start_date'],
            'end_date' => $validated['end_date'] ?? null,
            'next_run_at' => $validated['next_run_at'] ?? $validated['start_date'].' 00:00:00',
            'is_active' => (bool) ($validated['is_active'] ?? true),
            'created_by' => $request->user()?->id,
        ]);

        return response()->json(['message' => 'Recurring expense rule created.', 'rule' => $row], 201);
    }

    public function update(Request $request, string $rule): JsonResponse
    {
        $model = $this->resolveRule($request, $rule);
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        $validated = $this->validatePayload($request, $tenant, $model->id, true);

        foreach (['category_id', 'customer_id', 'title', 'cadence', 'start_date', 'end_date', 'next_run_at'] as $field) {
            if (array_key_exists($field, $validated)) {
                $model->{$field} = $validated[$field];
            }
        }
        foreach (['amount', 'interval_value'] as $num) {
            if (array_key_exists($num, $validated)) {
                $model->{$num} = $num === 'amount'
                    ? number_format((float) $validated[$num], 2, '.', '')
                    : (int) $validated[$num];
            }
        }
        foreach (['description', 'payee', 'notes', 'payment_mode', 'payment_status'] as $text) {
            if (array_key_exists($text, $validated)) {
                $model->{$text} = in_array($text, ['payment_mode', 'payment_status'], true)
                    ? $validated[$text]
                    : $this->normalizeText($validated[$text]);
            }
        }
        if (array_key_exists('is_active', $validated)) {
            $model->is_active = (bool) $validated['is_active'];
        }
        $model->save();

        return response()->json(['message' => 'Recurring expense rule updated.', 'rule' => $model->fresh(['category', 'customer'])]);
    }

    public function destroy(Request $request, string $rule): JsonResponse
    {
        $model = $this->resolveRule($request, $rule);
        $model->delete();

        return response()->json(['message' => 'Recurring expense rule deleted.']);
    }

    public function runNow(Request $request, ExpenseRecurringGenerator $generator): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        $out = $generator->run((int) $tenant->id);

        return response()->json(['message' => 'Recurring expense generation completed.', ...$out]);
    }

    /**
     * @return array<string,mixed>
     */
    private function validatePayload(Request $request, Tenant $tenant, ?int $ignoreId = null, bool $partial = false): array
    {
        $rules = [
            'category_id' => ['nullable', 'integer', Rule::exists('expense_categories', 'id')->where(fn ($q) => $q->where('tenant_id', $tenant->id))],
            'customer_id' => ['nullable', 'integer', Rule::exists('customers', 'id')->where(fn ($q) => $q->where('tenant_id', $tenant->id)->whereNull('deleted_at'))],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:20000'],
            'payee' => ['nullable', 'string', 'max:255'],
            'amount' => ['required', 'numeric', 'gt:0'],
            'payment_mode' => ['nullable', 'string', Rule::in(Expense::PAYMENT_MODES)],
            'payment_status' => ['nullable', 'string', Rule::in(Expense::PAYMENT_STATUSES)],
            'notes' => ['nullable', 'string', 'max:20000'],
            'cadence' => ['required', 'string', Rule::in(ExpenseRecurringRule::CADENCES)],
            'interval_value' => ['nullable', 'integer', 'min:1', 'max:366'],
            'start_date' => ['required', 'date_format:Y-m-d'],
            'end_date' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:start_date'],
            'next_run_at' => ['nullable', 'date'],
            'is_active' => ['nullable', 'boolean'],
        ];

        if ($partial) {
            foreach ($rules as $key => $fieldRules) {
                $rules[$key] = array_merge(['sometimes'], $fieldRules);
            }
        }

        return $request->validate($rules);
    }

    private function normalizeText(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }
        $s = trim((string) $value);

        return $s === '' ? null : $s;
    }

    private function resolveRule(Request $request, string $rule): ExpenseRecurringRule
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        return ExpenseRecurringRule::query()
            ->where('tenant_id', $tenant->id)
            ->whereKey($rule)
            ->firstOrFail();
    }
}
