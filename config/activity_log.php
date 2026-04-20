<?php

/**
 * Activity log: which events to persist, how payment rows are stored, retention, and queue behavior.
 *
 * Queue: set QUEUE_CONNECTION=sync in .env for local/WAMP without a worker; use database (or redis)
 * plus `php artisan queue:work` in staging/production. Activity log writes are dispatched as jobs.
 */
return [

    'enabled' => env('ACTIVITY_LOG_ENABLED', true),

    /**
     * Allowlist of action slugs. Only these are queued for persistence. Add new actions here when
     * you introduce new ActivityLogWriter::record() call sites.
     *
     * @var list<string>
     */
    'record_actions' => [
        'customer.created',
        'customer.updated',
        'customer.deleted',

        'invoice.created',
        'invoice.updated',
        'invoice.sent_to_customer',
        'invoice.cancelled',
        'invoice.restored',
        'invoice.created_from_quotation',
        'invoice.customer_viewed',

        'invoice_payment.recorded',
        'invoice_payment.updated',
        'invoice_payment.deleted',

        'quotation.created',
        'quotation.updated',
        'quotation.deleted',
        'quotation.sent_to_customer',
        'quotation.converted_to_invoice',
        'quotation.customer_viewed',

        'proposal.customer_viewed',

        'automation.invoice_due_reminder',
        'automation.invoice_overdue',
        'automation.quotation_expiry_reminder',
        'automation.proposal_expiry_reminder',
    ],

    /**
     * When true (default), payment flows may log twice per event (InvoicePayment + Invoice) so
     * invoice-scoped timelines stay complete. When false, the Invoice duplicate row is skipped
     * for invoice_payment.* actions (single row on InvoicePayment only).
     */
    'dual_subject_invoice_and_payment' => env('ACTIVITY_LOG_DUAL_SUBJECT_INVOICE_PAYMENT', true),

    /** Default retention for `php artisan activity-logs:prune` (days). */
    'retention_days' => (int) env('ACTIVITY_LOG_RETENTION_DAYS', 730),

    /** Chunk size for prune deletes. */
    'prune_chunk' => (int) env('ACTIVITY_LOG_PRUNE_CHUNK', 1000),

];
