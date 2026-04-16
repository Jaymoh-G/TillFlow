<?php

/**
 * Canonical permission slugs — keep in sync with routes/api.php middleware: `permission:*`.
 * Paired modules: *.manage satisfies *.view (see User::hasPermission).
 */
return [
    'slugs' => [
        'tenant.manage',
        'users.manage',
        'reports.view',

        'catalog.masters.view',
        'catalog.masters.manage',
        'catalog.items.view',
        'catalog.items.manage',

        'inventory.stock_adjust.view',
        'inventory.stock_adjust.manage',
        'inventory.stock_transfer.view',
        'inventory.stock_transfer.manage',

        'stores.view',
        'stores.manage',

        'sales.orders.view',
        'sales.orders.manage',
        'sales.quotations.view',
        'sales.quotations.manage',
        'sales.invoices.view',
        'sales.invoices.manage',
        'sales.delivery_notes.view',
        'sales.delivery_notes.manage',
        'sales.credit_notes.view',
        'sales.credit_notes.manage',
        'sales.invoice_payments.view',
        'sales.invoice_payments.manage',
        'sales.returns.view',
        'sales.returns.manage',
        'sales.customers.view',
        'sales.customers.manage',
        'sales.billers.view',
        'sales.billers.manage',

        'procurement.suppliers.view',
        'procurement.suppliers.manage',
        'procurement.purchases.view',
        'procurement.purchases.manage',
        'procurement.purchase_returns.view',
        'procurement.purchase_returns.manage',

        'finance.expenses.view',
        'finance.expenses.manage',
    ],
];
