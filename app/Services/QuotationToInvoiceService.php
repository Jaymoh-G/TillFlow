<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Invoice;
use App\Models\Proposal;
use App\Models\Quotation;
use App\Models\Tenant;

class QuotationToInvoiceService
{
    /**
     * Create an invoice from a quotation (same behaviour as QuotationController::convertToInvoice).
     * Caller is responsible for wrapping in a DB transaction if needed.
     */
    public function createInvoiceFromQuotation(Tenant $tenant, Quotation $model): Invoice
    {
        $model->loadMissing([
            'items' => fn ($q) => $q->orderBy('position'),
            'customer:id,name,email,phone,location,avatar_url',
        ]);

        $invoice = Invoice::query()->create([
            'tenant_id' => $tenant->id,
            'invoice_ref' => $this->nextInvoiceRef($tenant->id),
            'invoice_title' => trim((string) ($model->quote_title ?? '')) ?: null,
            'issued_at' => now()->toDateString(),
            'due_at' => $model->expires_at ? $model->expires_at->format('Y-m-d') : null,
            'customer_id' => $model->customer_id,
            'customer_name' => $model->customer_name,
            'customer_image_url' => $model->customer_image_url,
            'status' => Invoice::STATUS_UNPAID,
            'sent_to_customer_at' => null,
            'discount_type' => $model->discount_type ?? 'none',
            'discount_basis' => $model->discount_basis ?? 'percent',
            'discount_value' => $model->discount_value,
            'total_amount' => (float) $model->total_amount,
            'amount_paid' => '0.00',
            'notes' => $model->client_note,
            'terms_and_conditions' => $model->terms_and_conditions,
        ]);

        foreach ($model->items as $item) {
            $invoice->items()->create([
                'product_id' => $item->product_id,
                'product_name' => $item->product_name,
                'product_image_url' => $item->product_image_url,
                'description' => $item->description,
                'quantity' => $item->quantity,
                'unit_price' => $item->unit_price,
                'tax_percent' => $item->tax_percent,
                'line_total' => $item->line_total,
                'position' => $item->position,
            ]);
        }

        $model->status = 'Accepted';
        $model->save();

        return $invoice->fresh(['items' => fn ($q) => $q->orderBy('position')]);
    }

    /**
     * Create an invoice directly from a proposal (no quotation record).
     * Caller is responsible for wrapping in a DB transaction if needed.
     */
    public function createInvoiceFromProposal(Tenant $tenant, Proposal $proposal, Customer $customer): Invoice
    {
        $proposal->loadMissing([
            'items' => fn ($q) => $q->orderBy('position'),
        ]);

        $invoice = Invoice::query()->create([
            'tenant_id' => $tenant->id,
            'invoice_ref' => $this->nextInvoiceRef($tenant->id),
            'invoice_title' => trim((string) ($proposal->proposal_title ?? '')) ?: null,
            'issued_at' => now()->toDateString(),
            'due_at' => $proposal->expires_at ? $proposal->expires_at->format('Y-m-d') : null,
            'customer_id' => $customer->id,
            'customer_name' => $customer->name,
            'customer_image_url' => $customer->avatar_url,
            'status' => Invoice::STATUS_UNPAID,
            'sent_to_customer_at' => null,
            'discount_type' => $proposal->discount_type ?? 'none',
            'discount_basis' => $proposal->discount_basis ?? 'percent',
            'discount_value' => $proposal->discount_value,
            'total_amount' => (float) $proposal->total_amount,
            'amount_paid' => '0.00',
            'notes' => $proposal->client_note,
            'terms_and_conditions' => $proposal->terms_and_conditions,
        ]);

        foreach ($proposal->items as $item) {
            $invoice->items()->create([
                'product_id' => $item->product_id,
                'product_name' => $item->product_name,
                'product_image_url' => $item->product_image_url,
                'description' => $item->description,
                'quantity' => $item->quantity,
                'unit_price' => $item->unit_price,
                'tax_percent' => $item->tax_percent,
                'line_total' => $item->line_total,
                'position' => $item->position,
            ]);
        }

        return $invoice->fresh(['items' => fn ($q) => $q->orderBy('position')]);
    }

    private function nextInvoiceRef(int $tenantId): string
    {
        $last = Invoice::query()
            ->where('tenant_id', $tenantId)
            ->where('invoice_ref', 'like', 'INV-%')
            ->where('status', '<>', Invoice::STATUS_DRAFT)
            ->orderByDesc('id')
            ->value('invoice_ref');

        $n = 0;
        if (is_string($last) && preg_match('/^INV-(\d{1,})$/', $last, $m)) {
            $n = (int) $m[1];
        }

        return 'INV-'.str_pad((string) ($n + 1), 6, '0', STR_PAD_LEFT);
    }
}
