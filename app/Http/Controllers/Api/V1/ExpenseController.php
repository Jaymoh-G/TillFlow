<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Expense;
use App\Models\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class ExpenseController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        $q = Expense::query()
            ->where('tenant_id', $tenant->id)
            ->with(['category:id,name', 'customer:id,name,email'])
            ->orderByDesc('expense_date')
            ->orderByDesc('id');

        if ($request->filled('q')) {
            $needle = '%'.str_replace(['%', '_'], ['\\%', '\\_'], (string) $request->query('q')).'%';
            $q->where(function ($w) use ($needle): void {
                $w->where('title', 'like', $needle)
                    ->orWhere('payee', 'like', $needle)
                    ->orWhere('description', 'like', $needle)
                    ->orWhere('notes', 'like', $needle);
            });
        }
        if ($request->filled('category_id')) {
            $q->where('category_id', (int) $request->query('category_id'));
        }
        if ($request->filled('customer_id')) {
            $q->where('customer_id', (int) $request->query('customer_id'));
        }
        if ($request->filled('payment_status')) {
            $q->where('payment_status', (string) $request->query('payment_status'));
        }
        if ($request->filled('payment_mode')) {
            $q->where('payment_mode', (string) $request->query('payment_mode'));
        }
        if ($request->filled('from')) {
            $q->whereDate('expense_date', '>=', (string) $request->query('from'));
        }
        if ($request->filled('to')) {
            $q->whereDate('expense_date', '<=', (string) $request->query('to'));
        }

        return response()->json(['message' => 'Expenses retrieved.', 'expenses' => $q->get()]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        $validated = $this->validatePayload($request, $tenant);

        $receiptPath = $this->storeReceipt($request->file('receipt'));
        if ($receiptPath === null && array_key_exists('receipt_path', $validated)) {
            $receiptPath = $this->normalizeText($validated['receipt_path']);
        }

        $row = Expense::query()->create([
            'tenant_id' => $tenant->id,
            'expense_date' => $validated['expense_date'],
            'category_id' => $validated['category_id'] ?? null,
            'customer_id' => $validated['customer_id'] ?? null,
            'payee' => $this->normalizeText($validated['payee'] ?? null),
            'title' => trim((string) $validated['title']),
            'description' => $this->normalizeText($validated['description'] ?? null),
            'amount' => number_format((float) $validated['amount'], 2, '.', ''),
            'payment_mode' => $validated['payment_mode'] ?? Expense::PAYMENT_MODE_CASH,
            'payment_status' => $validated['payment_status'] ?? Expense::PAYMENT_STATUS_UNPAID,
            'receipt_path' => $receiptPath,
            'notes' => $this->normalizeText($validated['notes'] ?? null),
            'created_by' => $request->user()?->id,
            'updated_by' => $request->user()?->id,
        ]);

        return response()->json(['message' => 'Expense created.', 'expense' => $row->fresh(['category', 'customer'])], 201);
    }

    public function update(Request $request, string $expense): JsonResponse
    {
        $row = $this->resolveExpense($request, $expense);
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        $validated = $this->validatePayload($request, $tenant, true);

        foreach (['expense_date', 'category_id', 'customer_id'] as $f) {
            if (array_key_exists($f, $validated)) {
                $row->{$f} = $validated[$f];
            }
        }
        foreach (['title', 'payee', 'description', 'notes'] as $f) {
            if (array_key_exists($f, $validated)) {
                $row->{$f} = $f === 'title' ? trim((string) $validated[$f]) : $this->normalizeText($validated[$f]);
            }
        }
        foreach (['payment_mode', 'payment_status'] as $f) {
            if (array_key_exists($f, $validated)) {
                $row->{$f} = $validated[$f];
            }
        }
        if (array_key_exists('amount', $validated)) {
            $row->amount = number_format((float) $validated['amount'], 2, '.', '');
        }

        if ($request->hasFile('receipt')) {
            $newPath = $this->storeReceipt($request->file('receipt'));
            if ($newPath !== null) {
                $row->receipt_path = $newPath;
            }
        } elseif (array_key_exists('receipt_path', $validated)) {
            $row->receipt_path = $this->normalizeText($validated['receipt_path']);
        }

        $row->updated_by = $request->user()?->id;
        $row->save();

        return response()->json(['message' => 'Expense updated.', 'expense' => $row->fresh(['category', 'customer'])]);
    }

    public function destroy(Request $request, string $expense): JsonResponse
    {
        $row = $this->resolveExpense($request, $expense);
        $row->delete();

        return response()->json(['message' => 'Expense deleted.']);
    }

    /**
     * @return array<string,mixed>
     */
    private function validatePayload(Request $request, Tenant $tenant, bool $partial = false): array
    {
        $rules = [
            'expense_date' => ['required', 'date_format:Y-m-d'],
            'category_id' => ['nullable', 'integer', Rule::exists('expense_categories', 'id')->where(fn ($q) => $q->where('tenant_id', $tenant->id))],
            'customer_id' => ['nullable', 'integer', Rule::exists('customers', 'id')->where(fn ($q) => $q->where('tenant_id', $tenant->id)->whereNull('deleted_at'))],
            'payee' => ['nullable', 'string', 'max:255'],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:20000'],
            'amount' => ['required', 'numeric', 'gt:0'],
            'payment_mode' => ['nullable', 'string', Rule::in(Expense::PAYMENT_MODES)],
            'payment_status' => ['nullable', 'string', Rule::in(Expense::PAYMENT_STATUSES)],
            'notes' => ['nullable', 'string', 'max:20000'],
            'receipt' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:5120'],
            'receipt_path' => ['nullable', 'string', 'max:1024'],
        ];

        if ($partial) {
            foreach ($rules as $key => $fieldRules) {
                $rules[$key] = array_merge(['sometimes'], $fieldRules);
            }
        }

        return $request->validate($rules);
    }

    private function resolveExpense(Request $request, string $expense): Expense
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        return Expense::query()->where('tenant_id', $tenant->id)->whereKey($expense)->firstOrFail();
    }

    private function normalizeText(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }
        $s = trim((string) $value);

        return $s === '' ? null : $s;
    }

    private function storeReceipt(?UploadedFile $file): ?string
    {
        if (! $file || ! $file->isValid()) {
            return null;
        }
        $path = $file->store('expenses/receipts', 'public');

        return $path ? Storage::disk('public')->url($path) : null;
    }
}
