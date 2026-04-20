<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Customer;
use App\Models\Invoice;
use App\Models\InvoicePayment;
use App\Models\Proposal;
use App\Models\Quotation;
use App\Models\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ActivityLogController extends Controller
{
    /** @var list<string> */
    private const ALLOWED_SUBJECT_TYPES = [
        Invoice::class,
        InvoicePayment::class,
        Customer::class,
        Quotation::class,
        Proposal::class,
    ];

    public function index(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $validated = $request->validate([
            'invoice_id' => ['nullable', 'integer'],
            'subject_type' => ['nullable', 'string', 'max:191'],
            'subject_id' => ['nullable', 'integer'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);

        $perPage = isset($validated['per_page']) ? (int) $validated['per_page'] : 20;
        $perPage = max(1, min(100, $perPage));

        $query = ActivityLog::query()
            ->where('tenant_id', $tenant->id)
            ->with(['user:id,name'])
            ->orderByDesc('created_at')
            ->orderByDesc('id');

        if (isset($validated['from'])) {
            $query->whereDate('created_at', '>=', $validated['from']);
        }
        if (isset($validated['to'])) {
            $query->whereDate('created_at', '<=', $validated['to']);
        }

        if (isset($validated['invoice_id'])) {
            $invoice = Invoice::query()
                ->where('tenant_id', $tenant->id)
                ->where('id', (int) $validated['invoice_id'])
                ->firstOrFail();

            $paymentIds = InvoicePayment::query()
                ->where('tenant_id', $tenant->id)
                ->where('invoice_id', $invoice->id)
                ->pluck('id');

            $invMorph = (new Invoice)->getMorphClass();
            $payMorph = (new InvoicePayment)->getMorphClass();

            $query->where(function ($q) use ($invoice, $paymentIds, $invMorph, $payMorph): void {
                $q->where(function ($q2) use ($invoice, $invMorph): void {
                    $q2->where('subject_type', $invMorph)
                        ->where('subject_id', $invoice->id);
                });
                if (! $paymentIds->isEmpty()) {
                    $q->orWhere(function ($q2) use ($paymentIds, $payMorph): void {
                        $q2->where('subject_type', $payMorph)
                            ->whereIn('subject_id', $paymentIds);
                    });
                }
                // Logs that store invoice context only in JSON (compat / cross-subject).
                $q->orWhere('properties->invoice_id', $invoice->id);
            });
        } elseif (isset($validated['subject_type'], $validated['subject_id'])) {
            $type = (string) $validated['subject_type'];
            if (! in_array($type, self::ALLOWED_SUBJECT_TYPES, true)) {
                return response()->json([
                    'message' => 'Invalid subject_type.',
                ], 422);
            }

            $subjectId = (int) $validated['subject_id'];
            $this->assertSubjectBelongsToTenant($tenant, $type, $subjectId);

            $query->where('subject_type', $type)
                ->where('subject_id', $subjectId);
        }
        // else: tenant-wide list (optional global page)

        $paginator = $query->paginate($perPage);

        return response()->json([
            'message' => 'Activity logs retrieved.',
            'activity_logs' => collect($paginator->items())->map(fn (ActivityLog $log) => $this->serializeLog($log))->values()->all(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
            ],
        ]);
    }

    private function assertSubjectBelongsToTenant(Tenant $tenant, string $type, int $subjectId): void
    {
        if ($type === Invoice::class) {
            Invoice::query()
                ->where('tenant_id', $tenant->id)
                ->where('id', $subjectId)
                ->firstOrFail();

            return;
        }

        if ($type === Customer::class) {
            Customer::query()
                ->where('tenant_id', $tenant->id)
                ->where('id', $subjectId)
                ->firstOrFail();

            return;
        }

        if ($type === Quotation::class) {
            Quotation::query()
                ->where('tenant_id', $tenant->id)
                ->where('id', $subjectId)
                ->firstOrFail();

            return;
        }

        if ($type === Proposal::class) {
            Proposal::query()
                ->where('tenant_id', $tenant->id)
                ->where('id', $subjectId)
                ->firstOrFail();

            return;
        }

        InvoicePayment::query()
            ->where('tenant_id', $tenant->id)
            ->where('id', $subjectId)
            ->firstOrFail();
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeLog(ActivityLog $log): array
    {
        return [
            'id' => $log->id,
            'action' => $log->action,
            'subject_type' => $log->subject_type,
            'subject_id' => $log->subject_id,
            'properties' => $log->properties,
            'ip_address' => $log->ip_address,
            'created_at' => $log->created_at ? $log->created_at->toISOString() : null,
            'user' => $log->user ? $log->user->only(['id', 'name']) : null,
        ];
    }
}
