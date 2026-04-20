<?php

namespace App\Support;

use App\Models\Customer;
use App\Models\Invoice;
use App\Models\InvoicePayment;
use App\Models\Quotation;

final class ActivityLogProperties
{
    /**
     * @return array<string, mixed>
     */
    public static function invoicePayment(InvoicePayment $pay, Invoice $invoice): array
    {
        return [
            'invoice_id' => $invoice->id,
            'invoice_ref' => $invoice->invoice_ref,
            'payment_id' => $pay->id,
            'receipt_ref' => $pay->receipt_ref,
            'amount' => (float) $pay->amount,
            'payment_method' => $pay->payment_method,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public static function invoice(Invoice $inv): array
    {
        return [
            'invoice_id' => $inv->id,
            'invoice_ref' => $inv->invoice_ref,
            'status' => $inv->status,
            'total_amount' => (float) $inv->total_amount,
            'customer_name' => $inv->customer_name,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public static function customer(Customer $c): array
    {
        return [
            'customer_id' => $c->id,
            'code' => $c->code,
            'name' => $c->name,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public static function quotation(Quotation $q): array
    {
        return [
            'quotation_id' => $q->id,
            'quote_ref' => $q->quote_ref,
            'status' => $q->status,
            'total_amount' => (float) $q->total_amount,
        ];
    }
}
