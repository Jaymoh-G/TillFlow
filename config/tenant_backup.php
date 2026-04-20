<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Optional weekly email of per-tenant export (see tenant:backup-email)
    |--------------------------------------------------------------------------
    */
    'email' => [
        'enabled' => env('TENANT_BACKUP_EMAIL_ENABLED', false),
        'from_address' => env('TENANT_BACKUP_EMAIL_FROM', env('MAIL_FROM_ADDRESS')),
        'from_name' => env('TENANT_BACKUP_EMAIL_FROM_NAME', env('MAIL_FROM_NAME')),
    ],

    /*
    |--------------------------------------------------------------------------
    | Tables to dump in full (small reference data) when exporting one tenant
    |--------------------------------------------------------------------------
    */
    'global_full_tables' => [
        'permissions',
    ],

    /*
    |--------------------------------------------------------------------------
    | Child tables without tenant_id: parent table and FK column on the child
    |--------------------------------------------------------------------------
    */
    'indirect_tables' => [
        ['table' => 'invoice_items', 'parent' => 'invoices', 'foreign_key' => 'invoice_id'],
        ['table' => 'quotation_items', 'parent' => 'quotations', 'foreign_key' => 'quotation_id'],
        ['table' => 'proposal_items', 'parent' => 'proposals', 'foreign_key' => 'proposal_id'],
        ['table' => 'credit_note_items', 'parent' => 'credit_notes', 'foreign_key' => 'credit_note_id'],
        ['table' => 'delivery_note_items', 'parent' => 'delivery_notes', 'foreign_key' => 'delivery_note_id'],
        ['table' => 'pos_order_items', 'parent' => 'pos_orders', 'foreign_key' => 'pos_order_id'],
        ['table' => 'purchase_lines', 'parent' => 'purchases', 'foreign_key' => 'purchase_id'],
        ['table' => 'purchase_receipt_lines', 'parent' => 'purchase_receipts', 'foreign_key' => 'purchase_receipt_id'],
        ['table' => 'purchase_return_lines', 'parent' => 'purchase_returns', 'foreign_key' => 'purchase_return_id'],
        ['table' => 'stock_transfer_lines', 'parent' => 'stock_transfers', 'foreign_key' => 'stock_transfer_id'],
        ['table' => 'product_variants', 'parent' => 'products', 'foreign_key' => 'product_id'],
        ['table' => 'subscription_payments', 'parent' => 'tenant_subscriptions', 'foreign_key' => 'tenant_subscription_id'],
    ],

    /*
    |--------------------------------------------------------------------------
    | Skip these when auto-discovering tenant_id tables (system / non-business)
    |--------------------------------------------------------------------------
    */
    'exclude_tenant_tables' => [
        'migrations',
    ],

];
