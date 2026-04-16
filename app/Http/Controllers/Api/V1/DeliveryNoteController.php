<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Mail\DeliveryNoteSentToCustomer;
use App\Models\DeliveryNote;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Rule;

class DeliveryNoteController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $query = DeliveryNote::query()
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
                $sub->where('delivery_note_no', 'like', $needle)
                    ->orWhere('notes', 'like', $needle);
            });
        }

        $notes = $query->get();

        return response()->json([
            'message' => 'Delivery notes retrieved.',
            'delivery_notes' => $notes->map(fn (DeliveryNote $n) => $this->serializeDeliveryNote($n))->values()->all(),
        ]);
    }

    public function indexByInvoice(Request $request, string $invoice): JsonResponse
    {
        $inv = $this->resolveInvoice($request, $invoice);
        $notes = DeliveryNote::query()
            ->where('tenant_id', $inv->tenant_id)
            ->where('invoice_id', $inv->id)
            ->with('items')
            ->orderByDesc('issued_at')
            ->orderByDesc('id')
            ->get();

        return response()->json([
            'message' => 'Invoice delivery notes retrieved.',
            'delivery_notes' => $notes->map(fn (DeliveryNote $n) => $this->serializeDeliveryNote($n))->values()->all(),
            'invoice_delivery_state' => $this->invoiceDeliveryState($inv),
        ]);
    }

    public function show(Request $request, string $deliveryNote): JsonResponse
    {
        $note = $this->resolveDeliveryNote($request, $deliveryNote);

        return response()->json([
            'message' => 'Delivery note retrieved.',
            'delivery_note' => $this->serializeDeliveryNote($note),
        ]);
    }

    public function storeForInvoice(Request $request, string $invoice): JsonResponse
    {
        $inv = $this->resolveInvoice($request, $invoice);
        if (strcasecmp((string) $inv->status, Invoice::STATUS_CANCELLED) === 0) {
            return response()->json(['message' => 'Cancelled invoices cannot generate delivery notes.'], 422);
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
        $note = DB::transaction(function () use ($request, $inv, $validated, $rawItems, $tenantId): DeliveryNote {
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

            $deliveredByItem = DB::table('delivery_note_items as dni')
                ->join('delivery_notes as dn', 'dn.id', '=', 'dni.delivery_note_id')
                ->select('dni.invoice_item_id', DB::raw('SUM(dni.qty) as delivered_qty'))
                ->where('dn.tenant_id', $tenantId)
                ->where('dn.invoice_id', $invoice->id)
                ->where('dn.status', '!=', 'Cancelled')
                ->groupBy('dni.invoice_item_id')
                ->pluck('delivered_qty', 'dni.invoice_item_id');

            foreach ($rawItems as $item) {
                $invoiceItemId = (int) $item['invoice_item_id'];
                $requested = (float) $item['qty'];
                $line = $invoiceItems->get($invoiceItemId);
                $invoicedQty = (float) ($line->quantity ?? 0);
                $alreadyDelivered = (float) ($deliveredByItem[$invoiceItemId] ?? 0);
                $remaining = max(0, $invoicedQty - $alreadyDelivered);
                if ($requested > $remaining + 0.0001) {
                    abort(response()->json([
                        'message' => "Requested quantity exceeds remaining quantity for invoice item {$invoiceItemId}.",
                    ], 422));
                }
            }

            $note = DeliveryNote::query()->create([
                'tenant_id' => $tenantId,
                'delivery_note_no' => $this->nextDeliveryNoteRef($tenantId),
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
                $note->items()->create([
                    'invoice_item_id' => $line->id,
                    'product_id' => $item['product_id'] ?? $line->product_id,
                    'product_name' => $line->product_name,
                    'description' => $line->description,
                    'uom' => $item['uom'] ?? null,
                    'qty' => number_format((float) $item['qty'], 3, '.', ''),
                ]);
            }

            return $note->fresh(['items']);
        });

        return response()->json([
            'message' => 'Delivery note created.',
            'delivery_note' => $this->serializeDeliveryNote($note),
            'invoice_delivery_state' => $this->invoiceDeliveryState($inv->fresh()),
        ], 201);
    }

    public function update(Request $request, string $deliveryNote): JsonResponse
    {
        $note = $this->resolveDeliveryNote($request, $deliveryNote);

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
            'message' => 'Delivery note updated.',
            'delivery_note' => $this->serializeDeliveryNote($note->fresh(['items'])),
        ]);
    }

    public function cancel(Request $request, string $deliveryNote): JsonResponse
    {
        $note = $this->resolveDeliveryNote($request, $deliveryNote);
        if (strcasecmp((string) $note->status, 'Cancelled') === 0) {
            return response()->json(['message' => 'Delivery note is already cancelled.'], 422);
        }

        $note->status = 'Cancelled';
        $note->save();

        return response()->json([
            'message' => 'Delivery note cancelled.',
            'delivery_note' => $this->serializeDeliveryNote($note->fresh(['items'])),
            'invoice_delivery_state' => $this->invoiceDeliveryState($note->invoice()->firstOrFail()),
        ]);
    }

    public function emailPreview(Request $request, string $deliveryNote): JsonResponse
    {
        $note = $this->resolveDeliveryNote($request, $deliveryNote);
        $note->loadMissing('invoice.customer');
        $toEmail = strtolower(trim((string) ($note->invoice?->customer?->email ?? '')));
        $subject = 'Delivery Note '.$note->delivery_note_no.' — '.(string) ($note->invoice?->customer_name ?? 'Customer');

        return response()->json([
            'message' => 'Preview generated.',
            'subject' => $subject,
            'html' => '<p>Please find your delivery note attached.</p>',
            'to_email' => $toEmail,
            'message_template' => 'Please find your delivery note attached.',
        ]);
    }

    public function sendToCustomer(Request $request, string $deliveryNote): JsonResponse
    {
        $note = $this->resolveDeliveryNote($request, $deliveryNote);
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
                'message' => 'Delivery note PDF attachment is required. Please try again.',
            ], 422);
        }
        $pdfBinary = @file_get_contents($upload->getRealPath());
        if (! is_string($pdfBinary) || ! str_starts_with($pdfBinary, '%PDF')) {
            return response()->json([
                'message' => 'Invalid delivery note PDF attachment.',
            ], 422);
        }
        $safeNo = preg_replace('/[^\w.-]+/', '_', (string) $note->delivery_note_no) ?: 'delivery-note';
        $pdfFilename = 'delivery-note-'.$safeNo.'.pdf';

        Mail::to($email)->send(new DeliveryNoteSentToCustomer($note, $pdfBinary, $pdfFilename, $subjectOverride, $messageOverride));

        return response()->json([
            'message' => 'Delivery note sent to the customer.',
            'delivery_note' => $this->serializeDeliveryNote($note),
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

    private function resolveDeliveryNote(Request $request, string $deliveryNote): DeliveryNote
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        $q = DeliveryNote::query()->where('tenant_id', $tenant->id)->with('items');
        if (ctype_digit($deliveryNote)) {
            return $q->where('id', (int) $deliveryNote)->firstOrFail();
        }

        return $q->where('delivery_note_no', $deliveryNote)->firstOrFail();
    }

    private function nextDeliveryNoteRef(int $tenantId): string
    {
        $last = DeliveryNote::query()
            ->where('tenant_id', $tenantId)
            ->where('delivery_note_no', 'like', 'DN-%')
            ->orderByDesc('id')
            ->value('delivery_note_no');

        $n = 0;
        if (is_string($last) && preg_match('/^DN-(\d{1,})$/', $last, $m)) {
            $n = (int) $m[1];
        }

        return 'DN-'.str_pad((string) ($n + 1), 6, '0', STR_PAD_LEFT);
    }

    private function invoiceDeliveryState(Invoice $invoice): array
    {
        $invoicedQty = (float) InvoiceItem::query()->where('invoice_id', $invoice->id)->sum('quantity');
        $deliveredQty = (float) DB::table('delivery_note_items as dni')
            ->join('delivery_notes as dn', 'dn.id', '=', 'dni.delivery_note_id')
            ->where('dn.tenant_id', $invoice->tenant_id)
            ->where('dn.invoice_id', $invoice->id)
            ->where('dn.status', '!=', 'Cancelled')
            ->sum('dni.qty');
        $remainingQty = max(0, $invoicedQty - $deliveredQty);

        $status = 'Not delivered';
        if ($deliveredQty > 0 && $remainingQty > 0) {
            $status = 'Partially delivered';
        } elseif ($invoicedQty > 0 && $remainingQty <= 0.0001) {
            $status = 'Fully delivered';
        }

        return [
            'invoiced_qty_total' => round($invoicedQty, 3),
            'delivered_qty_total' => round($deliveredQty, 3),
            'remaining_qty_total' => round($remainingQty, 3),
            'status' => $status,
        ];
    }

    private function serializeDeliveryNote(DeliveryNote $n): array
    {
        $n->loadMissing(['items', 'invoice']);
        $items = $n->items;
        $qtyTotal = (float) $items->sum('qty');

        return [
            'id' => $n->id,
            'delivery_note_no' => $n->delivery_note_no,
            'invoice_id' => $n->invoice_id,
            'invoice_ref' => $n->invoice?->invoice_ref,
            'customer_id' => $n->customer_id,
            'customer_name' => $n->invoice?->customer_name ?? null,
            'customer_email' => $n->invoice?->customer?->email ?? null,
            'issued_at' => $n->issued_at ? $n->issued_at->format('Y-m-d') : null,
            'status' => $n->status,
            'notes' => $n->notes,
            'items' => $items->map(fn ($it) => [
                'id' => $it->id,
                'invoice_item_id' => $it->invoice_item_id,
                'product_id' => $it->product_id,
                'product_name' => $it->product_name,
                'description' => $it->description,
                'uom' => $it->uom,
                'qty' => $it->qty,
            ])->values()->all(),
            'total_items' => $items->count(),
            'total_qty' => round($qtyTotal, 3),
            'created_at' => $n->created_at ? $n->created_at->toISOString() : null,
            'updated_at' => $n->updated_at ? $n->updated_at->toISOString() : null,
        ];
    }
}
