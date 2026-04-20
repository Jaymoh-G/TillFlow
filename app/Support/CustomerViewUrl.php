<?php

namespace App\Support;

use Illuminate\Support\Facades\URL;

/**
 * Signed public URLs for customers to open from email (tracks first view for notifications).
 */
final class CustomerViewUrl
{
    public static function forInvoice(int $tenantId, int $invoiceId): string
    {
        return URL::temporarySignedRoute(
            'customer.document.view',
            now()->addYears(5),
            ['tenant' => $tenantId, 'type' => 'invoice', 'id' => $invoiceId],
            absolute: true
        );
    }

    public static function forQuotation(int $tenantId, int $quotationId): string
    {
        return URL::temporarySignedRoute(
            'customer.document.view',
            now()->addYears(5),
            ['tenant' => $tenantId, 'type' => 'quotation', 'id' => $quotationId],
            absolute: true
        );
    }

    public static function forProposal(int $tenantId, int $proposalId): string
    {
        return URL::temporarySignedRoute(
            'customer.document.view',
            now()->addYears(5),
            ['tenant' => $tenantId, 'type' => 'proposal', 'id' => $proposalId],
            absolute: true
        );
    }
}
