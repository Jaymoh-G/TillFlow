<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Mail\CreditNoteSentToCustomer;
use App\Models\CreditNote;
use App\Models\CreditNoteItem;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\View;
use Illuminate\Validation\Rule;

class CreditNoteController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $query = CreditNote::query()
            ->where('tenant_id', $tenant->id)
            ->with('items')
            ->orderByDesc('issued_at')
            ->orderByDesc('id');

        if ($request->filled('invoice_id')) {
            $query->where('invoice_id', (int) $request->query('invoice_id'));
        }
        if ($request->filled('customer_id')) {
            $query->where('customer_id', (int) $request->query('customer_id'));
        }
        if ($request->filled('status')) {
            $query->where('status', (string) $request->query('status'));
        }
        if ($request->filled('from')) {
            $query->whereDate('issued_at', '>=', (string) $request->query('from'));
        }
        if ($request->filled('to')) {
            $query->whereDate('issued_at', '<=', (string) $request->query('to'));
        }
        if ($request->filled('q')) {
            $needle = '%'.str_replace(['%', '_'], ['\\%', '\\_'], (string) $request->query('q')).'%';
            $query->where(function ($sub) use ($needle): void {
                $sub->where('credit_note_no', 'like', $needle)
                    ->orWhere('notes', 'like', $needle);
            });
        }

        $notes = $query->get();

        return response()->json([
            'message' => 'Credit notes retrieved.',
            'credit_notes' => $notes->map(fn (CreditNote $n) => $this->serializeCreditNote($n))->values()->all(),
        ]);
    }

    public function indexByInvoice(Request $request, string $invoice): JsonResponse
    {
        $inv = $this->resolveInvoice($request, $invoice);
        $notes = CreditNote::query()
            ->where('tenant_id', $inv->tenant_id)
            ->where('invoice_id', $inv->id)
            ->with('items')
            ->orderByDesc('issued_at')
            ->orderByDesc('id')
            ->get();

        return response()->json([
            'message' => 'Invoice credit notes retrieved.',
            'credit_notes' => $notes->map(fn (CreditNote $n) => $this->serializeCreditNote($n))->values()->all(),
        ]);
    }

    public function show(Request $request, string $creditNote): JsonResponse
    {
        $note = $this->resolveCreditNote($request, $creditNote);

        return response()->json([
            'message' => 'Credit note retrieved.',
            'credit_note' => $this->serializeCreditNote($note),
        ]);
    }

    public function storeForInvoice(Request $request, string $invoice): JsonResponse
    {
        $inv = $this->resolveInvoice($request, $invoice);
        if (strcasecmp((string) $inv->status, Invoice::STATUS_CANCELLED) === 0) {
            return response()->json(['message' => 'Cancelled invoices cannot generate credit notes.'], 422);
        }

        $validated = $request->validate([
            'issued_at' => ['nullable', 'date_format:Y-m-d'],
            'notes' => ['nullable', 'string', 'max:20000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.invoice_item_id' => ['required', 'integer', 'min:1'],
            'items.*.product_id' => ['nullable', 'integer', 'min:1'],
            'items.*.uom' => ['nullable', 'string', 'max:64'],
            'items.*.qty' => ['required', 'numeric', 'gt:0'],
        ]);

        $rawItems = collect($validated['items'] ?? [])->filter(function ($it) {
            return (float) ($it['qty'] ?? 0) > 0;
        })->values();
        if ($rawItems->isEmpty()) {
            return response()->json(['message' => 'At least one item quantity must be greater than zero.'], 422);
        }

        $tenantId = (int) $inv->tenant_id;
        $note = DB::transaction(function () use ($request, $inv, $validated, $rawItems, $tenantId): CreditNote {
            $invoice = Invoice::query()->where('tenant_id', $tenantId)->where('id', $inv->id)->lockForUpdate()->firstOrFail();

            $invoiceItemIds = $rawItems->pluck('invoice_item_id')->map(fn ($v) => (int) $v)->unique()->values()->all();
            $invoiceItems = InvoiceItem::query()
                ->where('invoice_id', $invoice->id)
                ->whereIn('id', $invoiceItemIds)
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            if ($invoiceItems->count() !== count($invoiceItemIds)) {
                abort(response()->json(['message' => 'One or more invoice items are invalid.'], 422));
            }

            $creditedByItem = DB::table('credit_note_items as cni')
                ->join('credit_notes as cn', 'cn.id', '=', 'cni.credit_note_id')
                ->select('cni.invoice_item_id', DB::raw('SUM(cni.qty) as credited_qty'))
                ->where('cn.tenant_id', $tenantId)
                ->where('cn.invoice_id', $invoice->id)
                ->where('cn.status', '!=', 'Cancelled')
                ->groupBy('cni.invoice_item_id')
                ->pluck('credited_qty', 'cni.invoice_item_id');

            foreach ($rawItems as $item) {
                $invoiceItemId = (int) $item['invoice_item_id'];
                $requested = (float) $item['qty'];
                $line = $invoiceItems->get($invoiceItemId);
                $invoicedQty = (float) ($line->quantity ?? 0);
                $alreadyCredited = (float) ($creditedByItem[$invoiceItemId] ?? 0);
                $remaining = max(0, $invoicedQty - $alreadyCredited);
                if ($requested > $remaining + 0.0001) {
                    abort(response()->json([
                        'message' => "Requested quantity exceeds remaining quantity for invoice item {$invoiceItemId}.",
                    ], 422));
                }
            }

            $note = CreditNote::query()->create([
                'tenant_id' => $tenantId,
                'credit_note_no' => $this->nextCreditNoteRef($tenantId),
                'invoice_id' => $invoice->id,
                'customer_id' => $invoice->customer_id,
                'issued_at' => $validated['issued_at'] ?? now()->toDateString(),
                'status' => 'Issued',
                'notes' => $validated['notes'] ?? null,
                'created_by' => $request->user()?->id,
            ]);

            foreach ($rawItems as $item) {
                $invoiceItemId = (int) $item['invoice_item_id'];
                /** @var InvoiceItem $line */
                $line = $invoiceItems->get($invoiceItemId);
                $qty = (float) $item['qty'];
                $unitPrice = (float) ($line->unit_price ?? 0);
                $note->items()->create([
                    'invoice_item_id' => $line->id,
                    'product_id' => $item['product_id'] ?? $line->product_id,
                    'product_name' => $line->product_name,
                    'description' => $line->description,
                    'uom' => $item['uom'] ?? null,
                    'qty' => number_format($qty, 3, '.', ''),
                    'unit_price' => number_format($unitPrice, 2, '.', ''),
                    'line_total' => number_format($qty * $unitPrice, 2, '.', ''),
                ]);
            }

            return $note->fresh(['items']);
        });

        return response()->json([
            'message' => 'Credit note created.',
            'credit_note' => $this->serializeCreditNote($note),
        ], 201);
    }

    public function update(Request $request, string $creditNote): JsonResponse
    {
        $note = $this->resolveCreditNote($request, $creditNote);

        $validated = $request->validate([
            'notes' => ['nullable', 'string', 'max:20000'],
            'status' => ['nullable', Rule::in(['Draft', 'Issued', 'Cancelled'])],
        ]);

        if (array_key_exists('notes', $validated)) {
            $note->notes = $validated['notes'];
        }
        if (array_key_exists('status', $validated) && $validated['status'] !== null) {
            $note->status = $validated['status'];
        }
        $note->save();

        return response()->json([
            'message' => 'Credit note updated.',
            'credit_note' => $this->serializeCreditNote($note->fresh(['items'])),
        ]);
    }

    public function cancel(Request $request, string $creditNote): JsonResponse
    {
        $note = $this->resolveCreditNote($request, $creditNote);
        if (strcasecmp((string) $note->status, 'Cancelled') === 0) {
            return response()->json(['message' => 'Credit note is already cancelled.'], 422);
        }

        $note->status = 'Cancelled';
        $note->save();

        return response()->json([
            'message' => 'Credit note cancelled.',
            'credit_note' => $this->serializeCreditNote($note->fresh(['items'])),
        ]);
    }

    public function emailPreview(Request $request, string $creditNote): JsonResponse
    {
        $note = $this->resolveCreditNote($request, $creditNote);
        $note->loadMissing('invoice.customer');
        $toEmail = strtolower(trim((string) ($note->invoice?->customer?->email ?? '')));
        $subject = 'Credit Note '.$note->credit_note_no.' — '.(string) ($note->invoice?->customer_name ?? 'Customer');
        $html = View::make('mail.credit-note-sent', ['creditNote' => $note, 'customMessage' => null])->render();

        return response()->json([
            'message' => 'Preview generated.',
            'subject' => $subject,
            'html' => $html,
            'to_email' => $toEmail,
            'message_template' => 'Please find your credit note attached.',
        ]);
    }

    public function sendToCustomer(Request $request, string $creditNote): JsonResponse
    {
        $note = $this->resolveCreditNote($request, $creditNote);
        $note->loadMissing('invoice.customer');

        $validated = $request->validate([
            'attachment_pdf' => ['nullable', 'file', 'mimes:pdf', 'max:20480'],
            'to_email' => ['nullable', 'string', 'max:255', 'email:rfc'],
            'subject' => ['nullable', 'string', 'max:255'],
            'message' => ['nullable', 'string', 'max:10000'],
        ]);

        $toOverride = strtolower(trim((string) ($validated['to_email'] ?? '')));
        $toCustomer = strtolower(trim((string) ($note->invoice?->customer?->email ?? '')));
        $email = $toOverride !== '' ? $toOverride : $toCustomer;
        if ($email === '' || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return response()->json([
                'message' => 'The customer has no valid email address. Update the customer record, then try again.',
            ], 422);
        }

        $subjectOverride = isset($validated['subject']) ? trim((string) $validated['subject']) : null;
        $messageOverride = isset($validated['message']) ? (string) $validated['message'] : null;
        $upload = $request->file('attachment_pdf');
        if ($upload === null || ! $upload->isValid()) {
            return response()->json([
                'message' => 'Credit note PDF attachment is required. Please try again.',
            ], 422);
        }
        $pdfBinary = @file_get_contents($upload->getRealPath());
        if (! is_string($pdfBinary) || ! str_starts_with($pdfBinary, '%PDF')) {
            return response()->json([
                'message' => 'Invalid credit note PDF attachment.',
            ], 422);
        }
        $safeNo = preg_replace('/[^\w.-]+/', '_', (string) $note->credit_note_no) ?: 'credit-note';
        $pdfFilename = 'credit-note-'.$safeNo.'.pdf';

        Mail::to($email)->send(new CreditNoteSentToCustomer($note, $pdfBinary, $pdfFilename, $subjectOverride, $messageOverride));

        return response()->json([
            'message' => 'Credit note sent to the customer.',
            'credit_note' => $this->serializeCreditNote($note),
        ]);
    }

    private function resolveInvoice(Request $request, string $invoice): Invoice
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        $q = Invoice::query()->where('tenant_id', $tenant->id);
        if (ctype_digit($invoice)) {
            return $q->where('id', (int) $invoice)->firstOrFail();
        }

        return $q->where('invoice_ref', $invoice)->firstOrFail();
    }

    private function resolveCreditNote(Request $request, string $creditNote): CreditNote
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        $q = CreditNote::query()->where('tenant_id', $tenant->id)->with(['items', 'invoice.customer']);
        if (ctype_digit($creditNote)) {
            return $q->where('id', (int) $creditNote)->firstOrFail();
        }

        return $q->where('credit_note_no', $creditNote)->firstOrFail();
    }

    private function nextCreditNoteRef(int $tenantId): string
    {
        $last = CreditNote::query()
            ->where('tenant_id', $tenantId)
            ->where('credit_note_no', 'like', 'CN-%')
            ->orderByDesc('id')
            ->value('credit_note_no');

        $n = 0;
        if (is_string($last) && preg_match('/^CN-(\d{1,})$/', $last, $m)) {
            $n = (int) $m[1];
        }

        return 'CN-'.str_pad((string) ($n + 1), 6, '0', STR_PAD_LEFT);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeCreditNote(CreditNote $n): array
    {
        $n->loadMissing(['items', 'invoice.customer']);
        $items = $n->items;
        $qtyTotal = (float) $items->sum('qty');
        $amountTotal = (float) $items->sum('line_total');

        return [
            'id' => $n->id,
            'credit_note_no' => $n->credit_note_no,
            'invoice_id' => $n->invoice_id,
            'invoice_ref' => $n->invoice?->invoice_ref,
            'customer_id' => $n->customer_id,
            'customer_name' => $n->invoice?->customer_name ?? null,
            'customer_email' => $n->invoice?->customer?->email ?? null,
            'issued_at' => $n->issued_at ? $n->issued_at->format('Y-m-d') : null,
            'status' => $n->status,
            'notes' => $n->notes,
            'items' => $items->map(fn (CreditNoteItem $it) => [
                'id' => $it->id,
                'invoice_item_id' => $it->invoice_item_id,
                'product_id' => $it->product_id,
                'product_name' => $it->product_name,
                'description' => $it->description,
                'uom' => $it->uom,
                'qty' => $it->qty,
                'unit_price' => $it->unit_price,
                'line_total' => $it->line_total,
            ])->values()->all(),
            'total_items' => $items->count(),
            'total_qty' => round($qtyTotal, 3),
            'total_amount' => round($amountTotal, 2),
            'created_at' => $n->created_at ? $n->created_at->toISOString() : null,
            'updated_at' => $n->updated_at ? $n->updated_at->toISOString() : null,
        ];
    }
}
