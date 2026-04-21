<?php

use App\Http\Controllers\Api\V1\ActivityLogController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\BillerController;
use App\Http\Controllers\Api\V1\BrandController;
use App\Http\Controllers\Api\V1\CategoryController;
use App\Http\Controllers\Api\V1\CreditNoteController;
use App\Http\Controllers\Api\V1\CustomerController;
use App\Http\Controllers\Api\V1\DeliveryNoteController;
use App\Http\Controllers\Api\V1\ExpenseCategoryController;
use App\Http\Controllers\Api\V1\ExpenseController;
use App\Http\Controllers\Api\V1\ExpenseRecurringController;
use App\Http\Controllers\Api\V1\ExpiredItemsReportController;
use App\Http\Controllers\Api\V1\InvoiceController;
use App\Http\Controllers\Api\V1\InvoicePaymentController;
use App\Http\Controllers\Api\V1\LeadController;
use App\Http\Controllers\Api\V1\LowStockReportController;
use App\Http\Controllers\Api\V1\MpesaWebhookController;
use App\Http\Controllers\Api\V1\PermissionController;
use App\Http\Controllers\Api\V1\Platform\PlatformDashboardController;
use App\Http\Controllers\Api\V1\Platform\PlatformMetaController;
use App\Http\Controllers\Api\V1\Platform\PlatformMpesaController;
use App\Http\Controllers\Api\V1\Platform\PlatformPlanController;
use App\Http\Controllers\Api\V1\Platform\PlatformSubscriptionPaymentController;
use App\Http\Controllers\Api\V1\Platform\PlatformTenantController;
use App\Http\Controllers\Api\V1\Platform\PlatformTenantSubscriptionController;
use App\Http\Controllers\Api\V1\PosOrderController;
use App\Http\Controllers\Api\V1\ProductController;
use App\Http\Controllers\Api\V1\ProposalController;
use App\Http\Controllers\Api\V1\ProposalReportController;
use App\Http\Controllers\Api\V1\PurchaseController;
use App\Http\Controllers\Api\V1\PurchaseReturnController;
use App\Http\Controllers\Api\V1\PushSubscriptionController;
use App\Http\Controllers\Api\V1\QuotationController;
use App\Http\Controllers\Api\V1\ReportsModuleController;
use App\Http\Controllers\Api\V1\RoleController;
use App\Http\Controllers\Api\V1\SalesReturnController;
use App\Http\Controllers\Api\V1\SmsTestController;
use App\Http\Controllers\Api\V1\StockAdjustmentController;
use App\Http\Controllers\Api\V1\StockTransferController;
use App\Http\Controllers\Api\V1\StoreManagerController;
use App\Http\Controllers\Api\V1\SupplierController;
use App\Http\Controllers\Api\V1\SystemHealthController;
use App\Http\Controllers\Api\V1\TenantCompanyProfileController;
use App\Http\Controllers\Api\V1\TenantUiSettingsController;
use App\Http\Controllers\Api\V1\TenantUserController;
use App\Http\Controllers\Api\V1\UnitController;
use App\Http\Controllers\Api\V1\VariantAttributeController;
use App\Http\Controllers\Api\V1\WarrantyController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::get('/health', [SystemHealthController::class, 'health']);
    Route::get('/ready', [SystemHealthController::class, 'ready']);

    Route::post('/auth/login', [AuthController::class, 'login']);
    Route::post('/auth/forgot-password', [AuthController::class, 'forgotPassword']);
    Route::post('/auth/reset-password', [AuthController::class, 'resetPassword']);

    Route::middleware(['auth:sanctum'])->group(function (): void {
        Route::get('/auth/me', [AuthController::class, 'me']);
        Route::patch('/auth/profile', [AuthController::class, 'updateProfile']);
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::post('/auth/password', [AuthController::class, 'changePassword']);
        Route::get('/auth/sessions', [AuthController::class, 'sessions']);
        Route::delete('/auth/sessions/{session}', [AuthController::class, 'revokeSession'])->whereNumber('session');
    });

    Route::post('/webhooks/mpesa/stk-callback', [MpesaWebhookController::class, 'stkCallback']);
    Route::post('/webhooks/mpesa/stk-timeout', [MpesaWebhookController::class, 'stkTimeout']);

    Route::middleware(['auth:sanctum', 'platform.owner'])->prefix('platform')->group(function (): void {
        Route::get('/dashboard', PlatformDashboardController::class);
        Route::get('/meta', PlatformMetaController::class);
        Route::apiResource('plans', PlatformPlanController::class)->only(['index', 'store', 'show', 'update', 'destroy']);
        Route::get('/tenants', [PlatformTenantController::class, 'index']);
        Route::post('/tenants', [PlatformTenantController::class, 'store']);
        Route::get('/tenants/{tenant}', [PlatformTenantController::class, 'show'])->whereNumber('tenant');
        Route::patch('/tenants/{tenant}', [PlatformTenantController::class, 'update'])->whereNumber('tenant');
        Route::get('/subscriptions', [PlatformTenantSubscriptionController::class, 'index']);
        Route::post('/subscriptions', [PlatformTenantSubscriptionController::class, 'store']);
        Route::patch('/subscriptions/{subscription}', [PlatformTenantSubscriptionController::class, 'update'])->whereNumber('subscription');
        Route::post('/subscription-payments', [PlatformSubscriptionPaymentController::class, 'store']);
        Route::post('/mpesa/stk-push', [PlatformMpesaController::class, 'stkPush']);
    });

    Route::middleware(['auth:sanctum', 'tenant.context'])->group(function (): void {
        Route::get('/tenant/company-profile', [TenantCompanyProfileController::class, 'show']);
        Route::patch('/tenant/company-profile', [TenantCompanyProfileController::class, 'update'])
            ->middleware('permission:tenant.manage');

        Route::get('/tenant/ui-settings', [TenantUiSettingsController::class, 'show']);
        Route::patch('/tenant/ui-settings', [TenantUiSettingsController::class, 'update'])
            ->middleware('permission:tenant.manage');

        Route::get('/push/vapid-public-key', [PushSubscriptionController::class, 'vapidPublicKey']);
        Route::post('/push/subscriptions', [PushSubscriptionController::class, 'store']);
        Route::delete('/push/subscriptions', [PushSubscriptionController::class, 'destroy']);

        Route::post('/sms/test', [SmsTestController::class, 'sendTest'])
            ->middleware('permission:tenant.manage');

        /* --- Catalog masters (categories, brands, units, variants, warranties) --- */
        Route::middleware(['permission:catalog.masters.view'])->group(function (): void {
            Route::get('/categories/trashed', [CategoryController::class, 'trashed']);
            Route::get('/categories', [CategoryController::class, 'index']);
            Route::get('/categories/{category}', [CategoryController::class, 'show'])->whereNumber('category');
            Route::get('/brands/trashed', [BrandController::class, 'trashed']);
            Route::get('/brands', [BrandController::class, 'index']);
            Route::get('/brands/{brand}', [BrandController::class, 'show'])->whereNumber('brand');
            Route::get('/units/trashed', [UnitController::class, 'trashed']);
            Route::get('/units', [UnitController::class, 'index']);
            Route::get('/units/{unit}', [UnitController::class, 'show'])->whereNumber('unit');
            Route::get('/variant-attributes/trashed', [VariantAttributeController::class, 'trashed']);
            Route::get('/variant-attributes', [VariantAttributeController::class, 'index']);
            Route::get('/variant-attributes/{attribute}', [VariantAttributeController::class, 'show'])->whereNumber('attribute');
            Route::get('/warranties/trashed', [WarrantyController::class, 'trashed']);
            Route::get('/warranties', [WarrantyController::class, 'index']);
            Route::get('/warranties/{warranty}', [WarrantyController::class, 'show'])->whereNumber('warranty');
        });

        Route::middleware(['permission:catalog.masters.manage'])->group(function (): void {
            Route::post('/categories', [CategoryController::class, 'store']);
            Route::post('/categories/{category}/restore', [CategoryController::class, 'restore'])->whereNumber('category');
            Route::put('/categories/{category}', [CategoryController::class, 'update'])->whereNumber('category');
            Route::patch('/categories/{category}', [CategoryController::class, 'update'])->whereNumber('category');
            Route::delete('/categories/{category}', [CategoryController::class, 'destroy'])->whereNumber('category');
            Route::post('/brands', [BrandController::class, 'store']);
            Route::post('/brands/{brand}/restore', [BrandController::class, 'restore'])->whereNumber('brand');
            Route::put('/brands/{brand}', [BrandController::class, 'update'])->whereNumber('brand');
            Route::patch('/brands/{brand}', [BrandController::class, 'update'])->whereNumber('brand');
            Route::delete('/brands/{brand}', [BrandController::class, 'destroy'])->whereNumber('brand');
            Route::post('/units', [UnitController::class, 'store']);
            Route::post('/units/{unit}/restore', [UnitController::class, 'restore'])->whereNumber('unit');
            Route::put('/units/{unit}', [UnitController::class, 'update'])->whereNumber('unit');
            Route::patch('/units/{unit}', [UnitController::class, 'update'])->whereNumber('unit');
            Route::delete('/units/{unit}', [UnitController::class, 'destroy'])->whereNumber('unit');
            Route::post('/variant-attributes', [VariantAttributeController::class, 'store']);
            Route::post('/variant-attributes/{attribute}/restore', [VariantAttributeController::class, 'restore'])->whereNumber('attribute');
            Route::put('/variant-attributes/{attribute}', [VariantAttributeController::class, 'update'])->whereNumber('attribute');
            Route::patch('/variant-attributes/{attribute}', [VariantAttributeController::class, 'update'])->whereNumber('attribute');
            Route::delete('/variant-attributes/{attribute}', [VariantAttributeController::class, 'destroy'])->whereNumber('attribute');
            Route::post('/warranties', [WarrantyController::class, 'store']);
            Route::post('/warranties/{warranty}/restore', [WarrantyController::class, 'restore'])->whereNumber('warranty');
            Route::put('/warranties/{warranty}', [WarrantyController::class, 'update'])->whereNumber('warranty');
            Route::patch('/warranties/{warranty}', [WarrantyController::class, 'update'])->whereNumber('warranty');
            Route::delete('/warranties/{warranty}', [WarrantyController::class, 'destroy'])->whereNumber('warranty');
        });

        /* --- Products / items --- */
        Route::middleware(['permission:catalog.items.view'])->group(function (): void {
            Route::get('/products/trashed', [ProductController::class, 'trashed']);
            Route::get('/products', [ProductController::class, 'index']);
            Route::get('/products/{product}', [ProductController::class, 'show'])->whereNumber('product');
            Route::get('/sales/catalog-products', [ProductController::class, 'index']);
        });

        Route::middleware(['permission:catalog.items.manage'])->group(function (): void {
            Route::post('/products', [ProductController::class, 'store']);
            Route::post('/products/{product}/restore', [ProductController::class, 'restore'])->whereNumber('product');
            Route::put('/products/{product}', [ProductController::class, 'update'])->whereNumber('product');
            Route::patch('/products/{product}', [ProductController::class, 'update'])->whereNumber('product');
            Route::post('/products/{product}/image', [ProductController::class, 'uploadMainImage'])->whereNumber('product');
            Route::post('/products/{product}/variants/{variant}/image', [ProductController::class, 'uploadVariantImage'])->whereNumber(['product', 'variant']);
            Route::delete('/products/{product}', [ProductController::class, 'destroy'])->whereNumber('product');
        });

        Route::middleware(['permission:inventory.stock_adjust.view'])->group(function (): void {
            Route::get('/stock-adjustments', [StockAdjustmentController::class, 'index']);
        });
        Route::middleware(['permission:inventory.stock_adjust.manage'])->group(function (): void {
            Route::post('/stock-adjustments', [StockAdjustmentController::class, 'store']);
        });

        Route::middleware(['permission:inventory.stock_transfer.view'])->group(function (): void {
            Route::get('/stock-transfers', [StockTransferController::class, 'index']);
        });
        Route::middleware(['permission:inventory.stock_transfer.manage'])->group(function (): void {
            Route::post('/stock-transfers', [StockTransferController::class, 'store']);
            Route::patch('/stock-transfers/{stockTransfer}', [StockTransferController::class, 'update'])->whereNumber('stockTransfer');
            Route::delete('/stock-transfers/{stockTransfer}', [StockTransferController::class, 'destroy'])->whereNumber('stockTransfer');
        });

        Route::middleware(['permission:procurement.suppliers.view'])->group(function (): void {
            Route::get('/suppliers', [SupplierController::class, 'index']);
            Route::get('/suppliers/{supplier}', [SupplierController::class, 'show'])->whereNumber('supplier');
        });
        Route::middleware(['permission:procurement.suppliers.manage'])->group(function (): void {
            Route::post('/suppliers', [SupplierController::class, 'store']);
            Route::put('/suppliers/{supplier}', [SupplierController::class, 'update'])->whereNumber('supplier');
            Route::patch('/suppliers/{supplier}', [SupplierController::class, 'update'])->whereNumber('supplier');
            Route::delete('/suppliers/{supplier}', [SupplierController::class, 'destroy'])->whereNumber('supplier');
        });

        Route::middleware(['permission:procurement.purchases.view'])->group(function (): void {
            Route::get('/purchases', [PurchaseController::class, 'index']);
            Route::get('/purchases/{purchase}', [PurchaseController::class, 'show'])->whereNumber('purchase');
            Route::get('/purchases/{purchase}/receipts', [PurchaseController::class, 'receipts'])->whereNumber('purchase');
            Route::get('/purchases/{purchase}/payments', [PurchaseController::class, 'payments'])->whereNumber('purchase');
        });
        Route::middleware(['permission:procurement.purchases.manage'])->group(function (): void {
            Route::post('/purchases', [PurchaseController::class, 'store']);
            Route::put('/purchases/{purchase}', [PurchaseController::class, 'update'])->whereNumber('purchase');
            Route::patch('/purchases/{purchase}', [PurchaseController::class, 'update'])->whereNumber('purchase');
            Route::post('/purchases/{purchase}/receive', [PurchaseController::class, 'receive'])->whereNumber('purchase');
            Route::post('/purchases/{purchase}/payments', [PurchaseController::class, 'addPayment'])->whereNumber('purchase');
            Route::post('/purchases/{purchase}/send-to-supplier', [PurchaseController::class, 'sendToSupplier'])->whereNumber('purchase');
            Route::delete('/purchases/{purchase}', [PurchaseController::class, 'destroy'])->whereNumber('purchase');
        });

        Route::middleware(['permission:procurement.purchase_returns.view'])->group(function (): void {
            Route::get('/purchase-returns', [PurchaseReturnController::class, 'index']);
        });
        Route::middleware(['permission:procurement.purchase_returns.manage'])->group(function (): void {
            Route::post('/purchase-returns', [PurchaseReturnController::class, 'store']);
            Route::put('/purchase-returns/{purchaseReturn}', [PurchaseReturnController::class, 'update'])->whereNumber('purchaseReturn');
            Route::patch('/purchase-returns/{purchaseReturn}', [PurchaseReturnController::class, 'update'])->whereNumber('purchaseReturn');
            Route::delete('/purchase-returns/{purchaseReturn}', [PurchaseReturnController::class, 'destroy'])->whereNumber('purchaseReturn');
        });

        Route::middleware(['permission:finance.expenses.view'])->group(function (): void {
            Route::get('/expense-categories', [ExpenseCategoryController::class, 'index']);
            Route::get('/expenses', [ExpenseController::class, 'index']);
            Route::get('/expense-recurring-rules', [ExpenseRecurringController::class, 'index']);
        });
        Route::middleware(['permission:finance.expenses.manage'])->group(function (): void {
            Route::post('/expense-categories', [ExpenseCategoryController::class, 'store']);
            Route::patch('/expense-categories/{category}', [ExpenseCategoryController::class, 'update'])->whereNumber('category');
            Route::delete('/expense-categories/{category}', [ExpenseCategoryController::class, 'destroy'])->whereNumber('category');
            Route::post('/expenses', [ExpenseController::class, 'store']);
            Route::patch('/expenses/{expense}', [ExpenseController::class, 'update'])->whereNumber('expense');
            Route::delete('/expenses/{expense}', [ExpenseController::class, 'destroy'])->whereNumber('expense');
            Route::post('/expense-recurring-rules', [ExpenseRecurringController::class, 'store']);
            Route::patch('/expense-recurring-rules/{rule}', [ExpenseRecurringController::class, 'update'])->whereNumber('rule');
            Route::delete('/expense-recurring-rules/{rule}', [ExpenseRecurringController::class, 'destroy'])->whereNumber('rule');
            Route::post('/expense-recurring-rules/run-now', [ExpenseRecurringController::class, 'runNow']);
        });

        Route::middleware(['permission:stores.view'])->group(function (): void {
            Route::get('/sales/stores', [StoreManagerController::class, 'index']);
            Route::get('/store-managers', [StoreManagerController::class, 'index']);
            Route::get('/stores', [StoreManagerController::class, 'index']);
            Route::get('/store-managers/{storeManager}', [StoreManagerController::class, 'show'])->whereNumber('storeManager');
            Route::get('/stores/{storeManager}', [StoreManagerController::class, 'show'])->whereNumber('storeManager');
        });
        Route::middleware(['permission:stores.manage'])->group(function (): void {
            Route::post('/store-managers', [StoreManagerController::class, 'store']);
            Route::put('/store-managers/{storeManager}', [StoreManagerController::class, 'update'])->whereNumber('storeManager');
            Route::patch('/store-managers/{storeManager}', [StoreManagerController::class, 'update'])->whereNumber('storeManager');
            Route::delete('/store-managers/{storeManager}', [StoreManagerController::class, 'destroy'])->whereNumber('storeManager');
            Route::post('/stores', [StoreManagerController::class, 'store']);
            Route::put('/stores/{storeManager}', [StoreManagerController::class, 'update'])->whereNumber('storeManager');
            Route::patch('/stores/{storeManager}', [StoreManagerController::class, 'update'])->whereNumber('storeManager');
            Route::delete('/stores/{storeManager}', [StoreManagerController::class, 'destroy'])->whereNumber('storeManager');
        });

        Route::middleware(['permission:sales.customers.view'])->group(function (): void {
            Route::get('/customers', [CustomerController::class, 'index']);
            Route::get('/customers/{customer}', [CustomerController::class, 'show'])->whereNumber('customer');
        });
        Route::middleware(['permission:sales.customers.manage'])->group(function (): void {
            Route::post('/customers', [CustomerController::class, 'store']);
            Route::put('/customers/{customer}', [CustomerController::class, 'update'])->whereNumber('customer');
            Route::patch('/customers/{customer}', [CustomerController::class, 'update'])->whereNumber('customer');
            Route::delete('/customers/{customer}', [CustomerController::class, 'destroy'])->whereNumber('customer');
        });

        Route::middleware(['permission:sales.billers.view'])->group(function (): void {
            Route::get('/billers', [BillerController::class, 'index']);
            Route::get('/billers/{biller}', [BillerController::class, 'show'])->whereNumber('biller');
        });
        Route::middleware(['permission:sales.billers.manage'])->group(function (): void {
            Route::post('/billers', [BillerController::class, 'store']);
            Route::put('/billers/{biller}', [BillerController::class, 'update'])->whereNumber('biller');
            Route::patch('/billers/{biller}', [BillerController::class, 'update'])->whereNumber('biller');
            Route::delete('/billers/{biller}', [BillerController::class, 'destroy'])->whereNumber('biller');
        });

        Route::middleware(['permission:sales.leads.view'])->group(function (): void {
            Route::get('/leads', [LeadController::class, 'index']);
            Route::get('/leads/{lead}', [LeadController::class, 'show'])->whereNumber('lead');
        });
        Route::middleware(['permission:sales.leads.view', 'permission:sales.proposals.view'])->group(function (): void {
            Route::get('/leads/{lead}/proposals', [LeadController::class, 'proposalsForLead'])->whereNumber('lead');
        });
        Route::middleware(['permission:sales.leads.manage'])->group(function (): void {
            Route::post('/leads', [LeadController::class, 'store']);
            Route::put('/leads/{lead}', [LeadController::class, 'update'])->whereNumber('lead');
            Route::patch('/leads/{lead}', [LeadController::class, 'update'])->whereNumber('lead');
            Route::delete('/leads/{lead}', [LeadController::class, 'destroy'])->whereNumber('lead');
        });
        Route::middleware(['permission:sales.leads.manage', 'permission:sales.customers.manage'])->group(function (): void {
            Route::post('/leads/{lead}/convert-to-customer', [LeadController::class, 'convertToCustomer'])->whereNumber('lead');
        });

        Route::middleware(['permission:sales.proposals.view'])->group(function (): void {
            Route::get('/proposals', [ProposalController::class, 'index']);
            Route::get('/proposals/{proposal}', [ProposalController::class, 'show'])->whereNumber('proposal');
        });
        Route::middleware(['permission:sales.proposals.manage'])->group(function (): void {
            Route::post('/proposals', [ProposalController::class, 'store']);
            Route::put('/proposals/{proposal}', [ProposalController::class, 'update'])->whereNumber('proposal');
            Route::patch('/proposals/{proposal}', [ProposalController::class, 'update'])->whereNumber('proposal');
            Route::delete('/proposals/{proposal}', [ProposalController::class, 'destroy'])->whereNumber('proposal');
            Route::post('/proposals/{proposal}/send-to-recipient', [ProposalController::class, 'sendToRecipient'])->whereNumber('proposal');
            Route::post('/proposals/{proposal}/accept', [ProposalController::class, 'accept'])->whereNumber('proposal');
        });

        Route::middleware(['permission:sales.quotations.view'])->group(function (): void {
            Route::get('/quotations', [QuotationController::class, 'index']);
            Route::get('/quotations/{quotation}', [QuotationController::class, 'show'])->whereNumber('quotation');
        });
        Route::middleware(['permission:sales.quotations.manage'])->group(function (): void {
            Route::post('/quotations', [QuotationController::class, 'store']);
            Route::put('/quotations/{quotation}', [QuotationController::class, 'update'])->whereNumber('quotation');
            Route::patch('/quotations/{quotation}', [QuotationController::class, 'update'])->whereNumber('quotation');
            Route::post('/quotations/{quotation}/send-to-customer', [QuotationController::class, 'sendToCustomer'])->whereNumber('quotation');
            Route::delete('/quotations/{quotation}', [QuotationController::class, 'destroy'])->whereNumber('quotation');
        });
        Route::post('/quotations/{quotation}/convert-to-invoice', [QuotationController::class, 'convertToInvoice'])
            ->whereNumber('quotation')
            ->middleware(['permission:sales.quotations.manage', 'permission:sales.invoices.manage']);

        Route::middleware(['permission:sales.invoice_payments.view'])->group(function (): void {
            Route::get('/invoice-payments', [InvoicePaymentController::class, 'indexAll']);
            Route::get('/invoice-payments/{payment}/email-preview', [InvoicePaymentController::class, 'emailPreview'])->whereNumber('payment');
        });
        Route::middleware(['permission:sales.invoice_payments.manage'])->group(function (): void {
            Route::post('/invoice-payments/{payment}/send-to-customer', [InvoicePaymentController::class, 'sendToCustomer'])->whereNumber('payment');
        });

        Route::middleware(['permission:sales.orders.view'])->group(function (): void {
            Route::get('/pos-orders/register-summary', [PosOrderController::class, 'registerSummary']);
            Route::get('/pos-orders', [PosOrderController::class, 'index']);
            Route::get('/pos-orders/{posOrder}', [PosOrderController::class, 'show'])->whereNumber('posOrder');
            Route::get('/pos-orders/{posOrder}/email-preview', [PosOrderController::class, 'emailPreview'])->whereNumber('posOrder');
        });
        Route::middleware(['permission:sales.orders.manage'])->group(function (): void {
            Route::post('/pos-orders', [PosOrderController::class, 'store']);
            Route::post('/pos-orders/{posOrder}/send-to-customer', [PosOrderController::class, 'sendToCustomer'])->whereNumber('posOrder');
        });

        Route::middleware(['permission:sales.invoices.view'])->group(function (): void {
            Route::get('/invoices', [InvoiceController::class, 'index']);
            Route::get('/invoices/{invoice}/email-preview', [InvoiceController::class, 'emailPreview']);
            Route::get('/invoices/{invoice}', [InvoiceController::class, 'show']);
            Route::get('/invoices/{invoice}/delivery-notes', [DeliveryNoteController::class, 'indexByInvoice']);
            Route::get('/invoices/{invoice}/credit-notes', [CreditNoteController::class, 'indexByInvoice']);
        });
        Route::middleware(['permission:sales.invoices.manage'])->group(function (): void {
            Route::post('/invoices', [InvoiceController::class, 'store']);
            Route::put('/invoices/{invoice}', [InvoiceController::class, 'update']);
            Route::patch('/invoices/{invoice}', [InvoiceController::class, 'update']);
            Route::post('/invoices/{invoice}/send-to-customer', [InvoiceController::class, 'sendToCustomer']);
            Route::post('/invoices/{invoice}/cancel', [InvoiceController::class, 'cancel']);
            Route::post('/invoices/{invoice}/restore', [InvoiceController::class, 'restore']);
            Route::delete('/invoices/{invoice}', [InvoiceController::class, 'destroy']);
        });

        Route::middleware(['permission:sales.delivery_notes.manage'])->group(function (): void {
            Route::post('/invoices/{invoice}/delivery-notes', [DeliveryNoteController::class, 'storeForInvoice']);
        });

        Route::middleware(['permission:sales.credit_notes.manage'])->group(function (): void {
            Route::post('/invoices/{invoice}/credit-notes', [CreditNoteController::class, 'storeForInvoice']);
        });

        Route::middleware(['permission:sales.delivery_notes.view'])->group(function (): void {
            Route::get('/delivery-notes', [DeliveryNoteController::class, 'index']);
            Route::get('/delivery-notes/{deliveryNote}', [DeliveryNoteController::class, 'show']);
            Route::get('/delivery-notes/{deliveryNote}/email-preview', [DeliveryNoteController::class, 'emailPreview']);
        });
        Route::middleware(['permission:sales.delivery_notes.manage'])->group(function (): void {
            Route::patch('/delivery-notes/{deliveryNote}', [DeliveryNoteController::class, 'update']);
            Route::post('/delivery-notes/{deliveryNote}/cancel', [DeliveryNoteController::class, 'cancel']);
            Route::post('/delivery-notes/{deliveryNote}/send-to-customer', [DeliveryNoteController::class, 'sendToCustomer']);
        });

        Route::middleware(['permission:sales.credit_notes.view'])->group(function (): void {
            Route::get('/credit-notes', [CreditNoteController::class, 'index']);
            Route::get('/credit-notes/{creditNote}', [CreditNoteController::class, 'show']);
            Route::get('/credit-notes/{creditNote}/email-preview', [CreditNoteController::class, 'emailPreview']);
        });
        Route::middleware(['permission:sales.credit_notes.manage'])->group(function (): void {
            Route::patch('/credit-notes/{creditNote}', [CreditNoteController::class, 'update']);
            Route::post('/credit-notes/{creditNote}/cancel', [CreditNoteController::class, 'cancel']);
            Route::post('/credit-notes/{creditNote}/send-to-customer', [CreditNoteController::class, 'sendToCustomer']);
        });

        Route::middleware(['permission:sales.returns.view'])->group(function (): void {
            Route::get('/sales-returns', [SalesReturnController::class, 'index']);
        });
        Route::middleware(['permission:sales.returns.manage'])->group(function (): void {
            Route::post('/sales-returns', [SalesReturnController::class, 'store']);
            Route::patch('/sales-returns/{salesReturn}', [SalesReturnController::class, 'update'])->whereNumber('salesReturn');
            Route::delete('/sales-returns/{salesReturn}', [SalesReturnController::class, 'destroy'])->whereNumber('salesReturn');
        });

        Route::middleware(['permission:sales.invoice_payments.view'])->group(function (): void {
            Route::get('/invoices/{invoice}/payments', [InvoicePaymentController::class, 'index']);
        });
        Route::middleware(['permission:sales.invoice_payments.manage'])->group(function (): void {
            Route::post('/invoices/{invoice}/payments', [InvoicePaymentController::class, 'store']);
            Route::patch('/invoices/{invoice}/payments/{payment}', [InvoicePaymentController::class, 'update']);
            Route::delete('/invoices/{invoice}/payments/{payment}', [InvoicePaymentController::class, 'destroy']);
        });

        Route::middleware(['permission:users.manage'])->group(function (): void {
            Route::get('/permissions', [PermissionController::class, 'index']);
            Route::get('/roles', [RoleController::class, 'index']);
            Route::patch('/roles/{role}', [RoleController::class, 'update'])->whereNumber('role');
            Route::get('/users', [TenantUserController::class, 'index']);
            Route::post('/users', [TenantUserController::class, 'store']);
            Route::patch('/users/{user}/roles', [TenantUserController::class, 'syncRoles'])->whereNumber('user');
        });

        Route::middleware(['permission:reports.view'])->group(function (): void {
            Route::get('/reports/low-stock', [LowStockReportController::class, 'index']);
            Route::get('/reports/expired-items', [ExpiredItemsReportController::class, 'index']);
            Route::get('/reports/sales-summary', [ReportsModuleController::class, 'salesSummary']);
            Route::get('/reports/payment-breakdown', [ReportsModuleController::class, 'paymentBreakdown']);
            Route::get('/reports/outstanding-invoices', [ReportsModuleController::class, 'outstandingInvoices']);
            Route::get('/reports/dashboard-top-customers', [ReportsModuleController::class, 'dashboardTopCustomers']);
            Route::get('/reports/dashboard-top-categories', [ReportsModuleController::class, 'dashboardTopCategories']);
            Route::get('/reports/dashboard-recent-transactions', [ReportsModuleController::class, 'dashboardRecentTransactions']);
            Route::get('/reports/dashboard-sales-purchase', [ReportsModuleController::class, 'dashboardSalesPurchase']);
            Route::get('/reports/dashboard-overall-information', [ReportsModuleController::class, 'dashboardOverallInformation']);
            Route::get('/reports/top-customers-arrears', [ReportsModuleController::class, 'topCustomersByArrears']);
            Route::get('/reports/invoice-register', [ReportsModuleController::class, 'invoiceRegister']);
            Route::get('/reports/tax-summary', [ReportsModuleController::class, 'taxSummary']);
            Route::get('/reports/z-light', [ReportsModuleController::class, 'zReportLight']);
            Route::get('/reports/return-summary', [ReportsModuleController::class, 'returnSummary']);
            Route::get('/reports/employee-sales', [ReportsModuleController::class, 'employeeSales']);
            Route::get('/reports/returns-by-staff', [ReportsModuleController::class, 'returnsByStaff']);
            Route::get('/reports/profit-loss', [ReportsModuleController::class, 'profitLoss']);
            Route::get('/reports/best-sellers', [ReportsModuleController::class, 'bestSellers']);
            Route::get('/reports/stock-movements', [ReportsModuleController::class, 'stockMovements']);
            Route::get('/reports/supplier-purchases', [ReportsModuleController::class, 'supplierPurchases']);
            Route::get('/reports/customer-kpis', [ReportsModuleController::class, 'customerKpis']);
            Route::get('/reports/expenses-by-category', [ReportsModuleController::class, 'expensesByCategory']);
            Route::get('/reports/income-summary', [ReportsModuleController::class, 'incomeSummary']);
            Route::get('/reports/annual-summary', [ReportsModuleController::class, 'annualSummary']);
            Route::get('/reports/customer-purchase-lines', [ReportsModuleController::class, 'purchaseLines']);
            Route::get('/reports/store-options', [ReportsModuleController::class, 'storeOptions']);
            Route::get('/reports/customer-options', [ReportsModuleController::class, 'customerOptions']);
        });

        Route::middleware(['permission:reports.view', 'permission:sales.proposals.view'])->group(function (): void {
            Route::get('/reports/proposals', [ProposalReportController::class, 'index']);
            Route::get('/reports/dashboard-recent-proposals', [ProposalReportController::class, 'dashboardRecentProposals']);
        });

        Route::middleware(['permission:system.activity_logs.view'])->group(function (): void {
            Route::get('/activity-logs', [ActivityLogController::class, 'index']);
        });
    });
});
