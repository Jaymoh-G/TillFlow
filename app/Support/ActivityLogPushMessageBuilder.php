<?php

namespace App\Support;

use App\Http\Controllers\Api\V1\ActivityLogController;

/**
 * Human-readable push payload aligned with {@see ActivityLogController} rows.
 */
final class ActivityLogPushMessageBuilder
{
    /**
     * @param  array<string, mixed>|null  $properties
     * @return array{title: string, body: string, url: string}
     */
    public static function build(string $action, ?array $properties): array
    {
        $p = $properties ?? [];
        $title = 'Activity';
        $parts = [];
        $url = '/tillflow/admin/notifications';

        if (str_starts_with($action, 'invoice_payment.')) {
            $title = 'Invoice payment';
            if (isset($p['receipt_ref'])) {
                $parts[] = (string) $p['receipt_ref'];
            }
            if (isset($p['amount'])) {
                $parts[] = 'Ksh '.number_format((float) $p['amount'], 2);
            }
            if (isset($p['payment_id'])) {
                $url = '/tillflow/admin/invoice-payments/'.(int) $p['payment_id'];
            }
        } elseif (str_starts_with($action, 'invoice.')) {
            $title = $action === 'invoice.customer_viewed' ? 'Customer viewed invoice' : 'Invoice';
            if (isset($p['invoice_ref'])) {
                $parts[] = (string) $p['invoice_ref'];
            }
            if (isset($p['customer_name'])) {
                $parts[] = (string) $p['customer_name'];
            }
            if ($action === 'invoice.customer_viewed') {
                $parts[] = 'Opened from email link';
            }
            if (isset($p['invoice_id'])) {
                $url = '/tillflow/admin/invoices/'.(int) $p['invoice_id'];
            }
        } elseif (str_starts_with($action, 'quotation.')) {
            $title = $action === 'quotation.customer_viewed' ? 'Customer viewed quotation' : 'Quotation';
            if (isset($p['quote_ref'])) {
                $parts[] = (string) $p['quote_ref'];
            }
            if ($action === 'quotation.customer_viewed') {
                $parts[] = 'Opened from email link';
            }
            if (isset($p['quotation_id'])) {
                $url = '/tillflow/admin/quotations/'.(int) $p['quotation_id'];
            }
        } elseif (str_starts_with($action, 'proposal.')) {
            $title = $action === 'proposal.customer_viewed' ? 'Customer viewed proposal' : 'Proposal';
            if (isset($p['proposal_ref'])) {
                $parts[] = (string) $p['proposal_ref'];
            }
            if ($action === 'proposal.customer_viewed') {
                $parts[] = 'Opened from email link';
            }
            if (isset($p['proposal_id'])) {
                $url = '/tillflow/admin/proposals/'.(int) $p['proposal_id'];
            }
        } elseif (str_starts_with($action, 'customer.')) {
            $title = 'Customer';
            if (isset($p['name'])) {
                $parts[] = (string) $p['name'];
            }
            $url = '/tillflow/admin/customers';
        } else {
            $parts[] = $action;
        }

        $body = $parts !== [] ? implode(' · ', $parts) : $action;

        return [
            'title' => $title,
            'body' => $body,
            'url' => $url,
        ];
    }
}
