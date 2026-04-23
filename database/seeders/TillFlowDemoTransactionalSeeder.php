<?php

namespace Database\Seeders;

use App\Models\Biller;
use App\Models\CreditNote;
use App\Models\CreditNoteItem;
use App\Models\Customer;
use App\Models\DeliveryNote;
use App\Models\DeliveryNoteItem;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\InvoicePayment;
use App\Models\Lead;
use App\Models\PosOrder;
use App\Models\PosOrderItem;
use App\Models\PosOrderPayment;
use App\Models\Product;
use App\Models\ProductQuantity;
use App\Models\Proposal;
use App\Models\ProposalItem;
use App\Models\Purchase;
use App\Models\PurchaseLine;
use App\Models\PurchasePayment;
use App\Models\PurchaseReceipt;
use App\Models\PurchaseReceiptLine;
use App\Models\Quotation;
use App\Models\QuotationItem;
use App\Models\SalesReturn;
use App\Models\SalesReturnLine;
use App\Models\StockAdjustment;
use App\Models\StockTransfer;
use App\Models\StockTransferLine;
use App\Models\StoreManager;
use App\Models\Supplier;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class TillFlowDemoTransactionalSeeder extends Seeder
{
    private const ROWS = 15;

    public function run(): void
    {
        $tenant = Tenant::query()->where('slug', 'tillflow-demo')->first();
        if (! $tenant) {
            if ($this->command) {
                $this->command->warn('TillFlow demo tenant (tillflow-demo) not found. Run TillFlowDemoTenantSeeder first.');
            }

            return;
        }

        $demoUser = User::query()->where('tenant_id', $tenant->id)->orderBy('id')->first();

        DB::transaction(function () use ($tenant, $demoUser): void {
            $this->cleanupDemoData($tenant->id);

            $stores = $this->seedStores($tenant->id);
            $allSeededProducts = $this->seededProducts($tenant->id);
            $products = $this->demoProducts($tenant->id);
            $this->hydrateProducts($tenant->id, $stores, $allSeededProducts);
            $this->seedProductQuantities($tenant->id, $stores, $allSeededProducts);

            $suppliers = $this->seedSuppliers($tenant->id);
            $customers = $this->seedCustomers($tenant->id);
            $expenseCategories = $this->seedExpenseCategories($tenant->id, $demoUser ? $demoUser->id : null);
            $this->seedExpenses($tenant->id, $demoUser ? $demoUser->id : null, $expenseCategories, $customers);
            $biller = $this->seedBiller($tenant->id);

            $this->seedPurchases($tenant->id, $demoUser ? $demoUser->id : null, $suppliers, $products);
            $quotationRows = $this->seedQuotations($tenant->id, $customers, $biller, $products);
            $invoiceRows = $this->seedInvoices($tenant->id, $customers, $products);
            $this->seedDeliveryNotes($tenant->id, $demoUser ? $demoUser->id : null, $invoiceRows);
            $this->seedCreditNotes($tenant->id, $demoUser ? $demoUser->id : null, $invoiceRows);
            $this->seedLeadsAndProposals($tenant->id, $customers, $biller, $products, $quotationRows);
            $this->seedStockAdjustments($tenant->id, $demoUser ? $demoUser->id : null, $stores, $products);
            $this->seedStockTransfers($tenant->id, $stores, $products);
            $posOrders = $this->seedPosOrders($tenant->id, $demoUser ? $demoUser->id : null, $stores, $customers, $products);
            $this->seedSalesReturns($tenant->id, $demoUser ? $demoUser->id : null, $customers, $stores, $products, $invoiceRows, $posOrders);
        });

        if ($this->command) {
            $this->command->info('Seeded TillFlow demo transactional data: 3 stores and ~15 rows per document module.');
        }
    }

    private function cleanupDemoData(int $tenantId): void
    {
        if (Schema::hasTable('expenses')) {
            Expense::query()
                ->where('tenant_id', $tenantId)
                ->where('title', 'like', 'Demo Expense %')
                ->delete();
        }
        if (Schema::hasTable('expense_categories')) {
            ExpenseCategory::query()
                ->where('tenant_id', $tenantId)
                ->where('name', 'like', 'Demo Expense Category %')
                ->delete();
        }

        $posOrderIds = PosOrder::query()
            ->where('tenant_id', $tenantId)
            ->where('order_no', 'like', 'DPOS-%')
            ->pluck('id');
        PosOrderPayment::query()->whereIn('pos_order_id', $posOrderIds)->delete();
        PosOrderItem::query()->whereIn('pos_order_id', $posOrderIds)->delete();
        PosOrder::query()->whereIn('id', $posOrderIds)->delete();

        $salesReturnIds = SalesReturn::query()
            ->where('tenant_id', $tenantId)
            ->where('sales_return_no', 'like', 'DSR-%')
            ->pluck('id');
        SalesReturnLine::query()->whereIn('sales_return_id', $salesReturnIds)->delete();
        SalesReturn::query()->whereIn('id', $salesReturnIds)->delete();

        $stockTransferIds = StockTransfer::query()
            ->where('tenant_id', $tenantId)
            ->where('ref_number', 'like', 'DTR-%')
            ->pluck('id');
        StockTransferLine::query()->whereIn('stock_transfer_id', $stockTransferIds)->delete();
        StockTransfer::query()->whereIn('id', $stockTransferIds)->delete();

        StockAdjustment::query()
            ->where('tenant_id', $tenantId)
            ->where('reference', 'like', 'DADJ-%')
            ->delete();

        $proposalIds = Proposal::withTrashed()->where('tenant_id', $tenantId)->where('proposal_ref', 'like', 'DPRP-%')->pluck('id');
        ProposalItem::query()->whereIn('proposal_id', $proposalIds)->delete();
        Proposal::withTrashed()->whereIn('id', $proposalIds)->forceDelete();

        Lead::withTrashed()
            ->where('tenant_id', $tenantId)
            ->where('code', 'like', 'DLEAD-%')
            ->forceDelete();

        $invoiceIds = Invoice::withTrashed()->where('tenant_id', $tenantId)->where('invoice_ref', 'like', 'DINV-%')->pluck('id');
        $deliveryIds = DeliveryNote::query()->where('tenant_id', $tenantId)->whereIn('invoice_id', $invoiceIds)->pluck('id');
        DeliveryNoteItem::query()->whereIn('delivery_note_id', $deliveryIds)->delete();
        DeliveryNote::query()->whereIn('id', $deliveryIds)->delete();
        $creditIds = CreditNote::query()->where('tenant_id', $tenantId)->whereIn('invoice_id', $invoiceIds)->pluck('id');
        CreditNoteItem::query()->whereIn('credit_note_id', $creditIds)->delete();
        CreditNote::query()->whereIn('id', $creditIds)->delete();
        InvoicePayment::query()->whereIn('invoice_id', $invoiceIds)->delete();
        InvoiceItem::query()->whereIn('invoice_id', $invoiceIds)->delete();
        Invoice::withTrashed()->whereIn('id', $invoiceIds)->forceDelete();

        $quotationIds = Quotation::withTrashed()->where('tenant_id', $tenantId)->where('quote_ref', 'like', 'DQUO-%')->pluck('id');
        QuotationItem::query()->whereIn('quotation_id', $quotationIds)->delete();
        Quotation::withTrashed()->whereIn('id', $quotationIds)->forceDelete();

        $purchaseIds = Purchase::query()
            ->where('tenant_id', $tenantId)
            ->where('reference', 'like', 'DPUR-%')
            ->pluck('id');
        $receiptIds = PurchaseReceipt::query()->whereIn('purchase_id', $purchaseIds)->pluck('id');
        PurchaseReceiptLine::query()->whereIn('purchase_receipt_id', $receiptIds)->delete();
        PurchaseReceipt::query()->whereIn('id', $receiptIds)->delete();
        PurchasePayment::query()->whereIn('purchase_id', $purchaseIds)->delete();
        PurchaseLine::query()->whereIn('purchase_id', $purchaseIds)->delete();
        Purchase::query()->whereIn('id', $purchaseIds)->delete();

        ProductQuantity::query()
            ->where('tenant_id', $tenantId)
            ->delete();

        StoreManager::withTrashed()->where('tenant_id', $tenantId)->where('code', 'like', 'DST-%')->forceDelete();
        Biller::withTrashed()->where('tenant_id', $tenantId)->where('code', 'like', 'DBIL-%')->forceDelete();
        Supplier::withTrashed()->where('tenant_id', $tenantId)->where('code', 'like', 'DSUP-%')->forceDelete();
        Customer::withTrashed()->where('tenant_id', $tenantId)->where('code', 'like', 'DCUS-%')->forceDelete();
    }

    /** @return Collection<int, StoreManager> */
    private function seedStores(int $tenantId): Collection
    {
        $stores = collect();
        for ($i = 1; $i <= 3; $i++) {
            $stores->push(StoreManager::query()->create([
                'tenant_id' => $tenantId,
                'code' => sprintf('DST-%03d', $i),
                'store_name' => 'Demo Store '.$i,
                'username' => 'demo_store_'.$i,
                'password' => 'Demo1234',
                'email' => 'store'.$i.'@tillflowpos.com',
                'phone' => '0700000'.str_pad((string) $i, 3, '0', STR_PAD_LEFT),
                'location' => 'Demo Location '.$i,
                'status' => 'active',
            ]));
        }

        return $stores;
    }

    /** @return Collection<int, Product> */
    private function seededProducts(int $tenantId): Collection
    {
        return Product::query()
            ->where('tenant_id', $tenantId)
            ->where(function ($q): void {
                $q->where('sku', 'like', 'SEED-%')
                    ->orWhere('sku', 'like', 'ITEM-%');
            })
            ->orderBy('id')
            ->get()
            ->values();
    }

    /** @return Collection<int, Product> */
    private function demoProducts(int $tenantId): Collection
    {
        $seed = Product::query()
            ->where('tenant_id', $tenantId)
            ->where('sku', 'like', 'ITEM-%')
            ->orderBy('id')
            ->limit(self::ROWS)
            ->get();

        if ($seed->count() < self::ROWS) {
            $needed = self::ROWS - $seed->count();
            $items = Product::query()
                ->where('tenant_id', $tenantId)
                ->where('sku', 'like', 'SEED-%')
                ->orderBy('id')
                ->limit($needed)
                ->get();
            $seed = $seed->concat($items);
        }

        return $seed->values();
    }

    /** @param Collection<int, StoreManager> $stores * @param Collection<int, Product> $products */
    private function seedProductQuantities(int $tenantId, Collection $stores, Collection $products): void
    {
        foreach ($stores as $sidx => $store) {
            foreach ($products as $pidx => $product) {
                ProductQuantity::query()->create([
                    'tenant_id' => $tenantId,
                    'product_id' => $product->id,
                    'store_id' => $store->id,
                    'qty' => 20 + (($pidx + $sidx) % 12),
                ]);
            }
        }

        $totals = ProductQuantity::query()
            ->where('tenant_id', $tenantId)
            ->selectRaw('product_id, SUM(qty) as total_qty')
            ->groupBy('product_id')
            ->pluck('total_qty', 'product_id');

        foreach ($products as $product) {
            $sum = (float) ($totals[$product->id] ?? 0);
            $product->qty = (int) round($sum, 0);
            $product->save();
        }
    }

    /** @param Collection<int, StoreManager> $stores * @param Collection<int, Product> $products */
    private function hydrateProducts(int $tenantId, Collection $stores, Collection $products): void
    {
        $categoryIds = DB::table('categories')
            ->where('tenant_id', $tenantId)
            ->whereNull('deleted_at')
            ->orderBy('id')
            ->pluck('id')
            ->values();
        $brandIds = DB::table('brands')
            ->where('tenant_id', $tenantId)
            ->whereNull('deleted_at')
            ->orderBy('id')
            ->pluck('id')
            ->values();
        $unitIds = DB::table('units')
            ->where('tenant_id', $tenantId)
            ->whereNull('deleted_at')
            ->orderBy('id')
            ->pluck('id')
            ->values();

        foreach ($products as $idx => $product) {
            $store = $stores[$idx % $stores->count()];
            $buying = $product->buying_price !== null ? (float) $product->buying_price : round(95 + (($idx + 1) * 4.5), 2);
            $selling = $product->selling_price !== null ? (float) $product->selling_price : round($buying * 1.35, 2);
            $qtyAlert = $product->qty_alert !== null ? (int) $product->qty_alert : 6 + ($idx % 8);

            $product->category_id = $product->category_id ?? ($categoryIds[$idx % max(1, $categoryIds->count())] ?? null);
            $product->brand_id = $product->brand_id ?? ($brandIds[$idx % max(1, $brandIds->count())] ?? null);
            $product->unit_id = $product->unit_id ?? ($unitIds[$idx % max(1, $unitIds->count())] ?? null);
            $product->store_id = $store->id;
            $product->buying_price = $buying;
            $product->selling_price = $selling;
            $product->qty_alert = $qtyAlert;
            $product->save();
        }
    }

    /** @return Collection<int, Supplier> */
    private function seedSuppliers(int $tenantId): Collection
    {
        $rows = collect();
        for ($i = 1; $i <= self::ROWS; $i++) {
            $rows->push(Supplier::query()->create([
                'tenant_id' => $tenantId,
                'code' => sprintf('DSUP-%03d', $i),
                'name' => 'Demo Supplier '.$i,
                'email' => 'supplier'.$i.'@demo.local',
                'phone' => '071100'.str_pad((string) $i, 4, '0', STR_PAD_LEFT),
                'location' => 'Supplier Zone '.$i,
                'status' => 'active',
            ]));
        }

        return $rows;
    }

    /** @return Collection<int, Customer> */
    private function seedCustomers(int $tenantId): Collection
    {
        $rows = collect();
        for ($i = 1; $i <= self::ROWS; $i++) {
            $rows->push(Customer::query()->create([
                'tenant_id' => $tenantId,
                'code' => sprintf('DCUS-%03d', $i),
                'name' => 'Demo Customer '.$i,
                'email' => 'customer'.$i.'@demo.local',
                'company' => 'Demo Company '.$i,
                'tax_id' => 'KRA'.str_pad((string) $i, 5, '0', STR_PAD_LEFT),
                'category' => 'Retail',
                'phone' => '072200'.str_pad((string) $i, 4, '0', STR_PAD_LEFT),
                'location' => 'Customer Block '.$i,
                'status' => 'active',
            ]));
        }

        return $rows;
    }

    /** @return Collection<int, ExpenseCategory> */
    private function seedExpenseCategories(int $tenantId, ?int $userId): Collection
    {
        if (! Schema::hasTable('expense_categories')) {
            return collect();
        }

        $rows = collect();
        for ($i = 1; $i <= 5; $i++) {
            $rows->push(ExpenseCategory::query()->create([
                'tenant_id' => $tenantId,
                'name' => 'Demo Expense Category '.$i,
                'description' => 'Seeded expense category '.$i,
                'is_active' => true,
                'created_by' => $userId,
            ]));
        }

        return $rows;
    }

    /** @param Collection<int, ExpenseCategory> $categories * @param Collection<int, Customer> $customers */
    private function seedExpenses(int $tenantId, ?int $userId, Collection $categories, Collection $customers): void
    {
        if (! Schema::hasTable('expenses')) {
            return;
        }

        for ($i = 1; $i <= self::ROWS; $i++) {
            $customer = $customers[($i - 1) % $customers->count()];
            $category = $categories->isNotEmpty() ? $categories[($i - 1) % $categories->count()] : null;
            $categoryId = $category ? $category->id : null;
            $amount = round(350 + ($i * 57.5), 2);
            $paid = $i % 3 === 0;

            Expense::query()->create([
                'tenant_id' => $tenantId,
                'expense_date' => now()->subDays(self::ROWS - $i)->toDateString(),
                'category_id' => $categoryId,
                'customer_id' => $customer->id,
                'payee' => 'Demo Vendor '.(($i % 7) + 1),
                'title' => 'Demo Expense '.$i,
                'description' => 'Seeded operational expense '.$i,
                'amount' => $amount,
                'payment_mode' => Expense::PAYMENT_MODES[($i - 1) % count(Expense::PAYMENT_MODES)],
                'payment_status' => $paid ? Expense::PAYMENT_STATUS_PAID : Expense::PAYMENT_STATUS_UNPAID,
                'receipt_path' => null,
                'notes' => 'Demo seeded expense record',
                'created_by' => $userId,
                'updated_by' => $userId,
            ]);
        }
    }

    private function seedBiller(int $tenantId): Biller
    {
        return Biller::query()->create([
            'tenant_id' => $tenantId,
            'code' => 'DBIL-001',
            'name' => 'TillFlow Demo Biller',
            'company' => 'TillFlow Demo Ltd',
            'email' => 'billing@tillflowpos.com',
            'phone' => '0733000001',
            'location' => 'HQ',
            'status' => 'active',
        ]);
    }

    /** @param Collection<int, Supplier> $suppliers * @param Collection<int, Product> $products */
    private function seedPurchases(int $tenantId, ?int $userId, Collection $suppliers, Collection $products): void
    {
        for ($i = 1; $i <= self::ROWS; $i++) {
            $supplier = $suppliers[($i - 1) % $suppliers->count()];
            $p1 = $products[($i - 1) % $products->count()];
            $p2 = $products[$i % $products->count()];
            $lineTotal1 = round((8 + $i) * 45.50, 2);
            $lineTotal2 = round((4 + $i) * 30.25, 2);
            $grand = round($lineTotal1 + $lineTotal2, 2);
            $paid = round($grand * 0.6, 2);

            $purchase = Purchase::query()->create([
                'tenant_id' => $tenantId,
                'supplier_id' => $supplier->id,
                'reference' => sprintf('DPUR-%04d', $i),
                'purchase_date' => now()->subDays(self::ROWS - $i)->toDateString(),
                'status' => 'received',
                'purchase_type' => 'regular',
                'order_tax' => 0,
                'order_discount' => 0,
                'shipping' => 0,
                'description' => 'Demo purchase '.$i,
                'grand_total' => $grand,
                'paid_amount' => $paid,
                'due_amount' => round($grand - $paid, 2),
                'payment_status' => $paid >= $grand ? 'paid' : 'partial',
            ]);

            $line1 = PurchaseLine::query()->create([
                'purchase_id' => $purchase->id,
                'product_id' => $p1->id,
                'sort_order' => 1,
                'product_name' => $p1->name,
                'qty' => 8 + $i,
                'received_qty' => 8 + $i,
                'unit_price' => 45.50,
                'discount_amount' => 0,
                'tax_percent' => 0,
                'line_total' => $lineTotal1,
            ]);

            $line2 = PurchaseLine::query()->create([
                'purchase_id' => $purchase->id,
                'product_id' => $p2->id,
                'sort_order' => 2,
                'product_name' => $p2->name,
                'qty' => 4 + $i,
                'received_qty' => 4 + $i,
                'unit_price' => 30.25,
                'discount_amount' => 0,
                'tax_percent' => 0,
                'line_total' => $lineTotal2,
            ]);

            $receipt = PurchaseReceipt::query()->create([
                'tenant_id' => $tenantId,
                'purchase_id' => $purchase->id,
                'received_at' => now()->subDays(self::ROWS - $i)->toDateString(),
                'reference' => sprintf('DREC-%04d', $i),
                'note' => 'Demo receipt',
                'created_by_user_id' => $userId,
            ]);

            PurchaseReceiptLine::query()->create([
                'purchase_receipt_id' => $receipt->id,
                'purchase_line_id' => $line1->id,
                'product_id' => $p1->id,
                'qty_received' => $line1->qty,
            ]);
            PurchaseReceiptLine::query()->create([
                'purchase_receipt_id' => $receipt->id,
                'purchase_line_id' => $line2->id,
                'product_id' => $p2->id,
                'qty_received' => $line2->qty,
            ]);

            PurchasePayment::query()->create([
                'tenant_id' => $tenantId,
                'purchase_id' => $purchase->id,
                'paid_at' => now()->subDays(self::ROWS - $i)->toDateString(),
                'amount' => $paid,
                'method' => 'bank_transfer',
                'reference' => sprintf('DPP-%04d', $i),
                'note' => 'Demo partial payment',
                'created_by_user_id' => $userId,
            ]);
        }
    }

    /** @param Collection<int, Customer> $customers * @param Collection<int, Product> $products
     * @return Collection<int, Quotation>
     */
    private function seedQuotations(int $tenantId, Collection $customers, Biller $biller, Collection $products): Collection
    {
        $rows = collect();
        for ($i = 1; $i <= self::ROWS; $i++) {
            $customer = $customers[($i - 1) % $customers->count()];
            $p1 = $products[($i - 1) % $products->count()];
            $p2 = $products[$i % $products->count()];
            $line1 = round((1 + $i) * 120.00, 2);
            $line2 = round((2 + $i) * 75.00, 2);
            $total = round($line1 + $line2, 2);

            $quotation = Quotation::query()->create([
                'tenant_id' => $tenantId,
                'quote_ref' => sprintf('DQUO-%04d', $i),
                'quote_title' => 'Demo quotation '.$i,
                'quoted_at' => now()->subDays(self::ROWS - $i)->toDateString(),
                'expires_at' => now()->addDays(14)->toDateString(),
                'customer_id' => $customer->id,
                'biller_id' => $biller->id,
                'biller_name' => $biller->name,
                'customer_name' => $customer->name,
                'status' => 'Sent',
                'discount_type' => 'none',
                'discount_basis' => 'percent',
                'discount_value' => 0,
                'total_amount' => $total,
                'client_note' => 'Demo quote note',
                'terms_and_conditions' => 'Demo terms',
            ]);

            QuotationItem::query()->create([
                'quotation_id' => $quotation->id,
                'product_id' => $p1->id,
                'product_name' => $p1->name,
                'description' => 'Primary quoted item',
                'quantity' => 1 + $i,
                'unit_price' => 120.00,
                'tax_percent' => 0,
                'line_total' => $line1,
                'position' => 1,
            ]);
            QuotationItem::query()->create([
                'quotation_id' => $quotation->id,
                'product_id' => $p2->id,
                'product_name' => $p2->name,
                'description' => 'Secondary quoted item',
                'quantity' => 2 + $i,
                'unit_price' => 75.00,
                'tax_percent' => 0,
                'line_total' => $line2,
                'position' => 2,
            ]);

            $rows->push($quotation);
        }

        return $rows;
    }

    /** @param Collection<int, Customer> $customers * @param Collection<int, Product> $products
     * @return Collection<int, Invoice>
     */
    private function seedInvoices(int $tenantId, Collection $customers, Collection $products): Collection
    {
        $rows = collect();
        for ($i = 1; $i <= self::ROWS; $i++) {
            $customer = $customers[($i - 1) % $customers->count()];
            $p1 = $products[($i - 1) % $products->count()];
            $p2 = $products[$i % $products->count()];
            $line1 = round((1 + $i) * 150.00, 2);
            $line2 = round((2 + $i) * 90.00, 2);
            $total = round($line1 + $line2, 2);
            $paid = round($total * 0.5, 2);

            $invoice = Invoice::query()->create([
                'tenant_id' => $tenantId,
                'invoice_ref' => sprintf('DINV-%04d', $i),
                'invoice_title' => 'Demo invoice '.$i,
                'issued_at' => now()->subDays(self::ROWS - $i)->toDateString(),
                'due_at' => now()->addDays(7)->toDateString(),
                'customer_id' => $customer->id,
                'customer_name' => $customer->name,
                'status' => Invoice::STATUS_UNPAID,
                'discount_type' => 'none',
                'discount_basis' => 'percent',
                'discount_value' => 0,
                'total_amount' => $total,
                'amount_paid' => 0,
                'notes' => 'Demo invoice',
                'terms_and_conditions' => 'Pay in 7 days',
            ]);

            InvoiceItem::query()->create([
                'invoice_id' => $invoice->id,
                'product_id' => $p1->id,
                'product_name' => $p1->name,
                'description' => 'Invoice line one',
                'quantity' => 1 + $i,
                'unit_price' => 150.00,
                'tax_percent' => 0,
                'line_total' => $line1,
                'position' => 1,
            ]);
            InvoiceItem::query()->create([
                'invoice_id' => $invoice->id,
                'product_id' => $p2->id,
                'product_name' => $p2->name,
                'description' => 'Invoice line two',
                'quantity' => 2 + $i,
                'unit_price' => 90.00,
                'tax_percent' => 0,
                'line_total' => $line2,
                'position' => 2,
            ]);

            InvoicePayment::query()->create([
                'tenant_id' => $tenantId,
                'invoice_id' => $invoice->id,
                'receipt_ref' => sprintf('DINVP-%04d', $i),
                'amount' => $paid,
                'payment_method' => InvoicePayment::METHOD_MPESA,
                'paid_at' => now()->subDays(max(0, self::ROWS - $i - 1)),
                'notes' => 'Demo partial payment',
                'transaction_id' => 'MPESA-DEMO-'.$i,
            ]);

            $invoice->recalculateAmountPaidAndStatus();
            $rows->push($invoice->fresh());
        }

        return $rows;
    }

    /** @param Collection<int, Invoice> $invoices */
    private function seedDeliveryNotes(int $tenantId, ?int $userId, Collection $invoices): void
    {
        foreach ($invoices as $idx => $invoice) {
            $delivery = DeliveryNote::query()->create([
                'tenant_id' => $tenantId,
                'delivery_note_no' => sprintf('DDN-%04d', $idx + 1),
                'invoice_id' => $invoice->id,
                'customer_id' => $invoice->customer_id,
                'issued_at' => now()->toDateString(),
                'status' => 'issued',
                'notes' => 'Demo delivery note',
                'created_by' => $userId,
            ]);

            $item = InvoiceItem::query()->where('invoice_id', $invoice->id)->orderBy('id')->first();
            if ($item) {
                DeliveryNoteItem::query()->create([
                    'delivery_note_id' => $delivery->id,
                    'invoice_item_id' => $item->id,
                    'product_id' => $item->product_id,
                    'product_name' => $item->product_name,
                    'description' => $item->description,
                    'uom' => 'pc',
                    'qty' => $item->quantity,
                ]);
            }
        }
    }

    /** @param Collection<int, Invoice> $invoices */
    private function seedCreditNotes(int $tenantId, ?int $userId, Collection $invoices): void
    {
        foreach ($invoices as $idx => $invoice) {
            $credit = CreditNote::query()->create([
                'tenant_id' => $tenantId,
                'credit_note_no' => sprintf('DCN-%04d', $idx + 1),
                'invoice_id' => $invoice->id,
                'customer_id' => $invoice->customer_id,
                'issued_at' => now()->toDateString(),
                'status' => 'issued',
                'notes' => 'Demo credit note',
                'created_by' => $userId,
            ]);

            $item = InvoiceItem::query()->where('invoice_id', $invoice->id)->orderBy('id')->first();
            if ($item) {
                CreditNoteItem::query()->create([
                    'credit_note_id' => $credit->id,
                    'invoice_item_id' => $item->id,
                    'product_id' => $item->product_id,
                    'product_name' => $item->product_name,
                    'description' => $item->description,
                    'uom' => 'pc',
                    'qty' => 1,
                    'unit_price' => $item->unit_price,
                    'line_total' => round((float) $item->unit_price, 2),
                ]);
            }
        }
    }

    /** @param Collection<int, Customer> $customers * @param Collection<int, Product> $products * @param Collection<int, Quotation> $quotations */
    private function seedLeadsAndProposals(int $tenantId, Collection $customers, Biller $biller, Collection $products, Collection $quotations): void
    {
        for ($i = 1; $i <= self::ROWS; $i++) {
            $customer = $customers[($i - 1) % $customers->count()];
            $proposalProduct = $products[($i - 1) % $products->count()];
            $quotation = $quotations[($i - 1) % $quotations->count()];
            $statuses = Lead::STATUSES;
            $status = $statuses[($i - 1) % count($statuses)];

            $lead = Lead::query()->create([
                'tenant_id' => $tenantId,
                'code' => sprintf('DLEAD-%04d', $i),
                'name' => 'Demo Lead '.$i,
                'email' => 'lead'.$i.'@demo.local',
                'company' => 'Lead Company '.$i,
                'phone' => '074400'.str_pad((string) $i, 4, '0', STR_PAD_LEFT),
                'location' => 'Lead Region '.$i,
                'source' => Lead::SOURCES[($i - 1) % count(Lead::SOURCES)],
                'status' => $status,
                'last_contacted_at' => now()->subDays($i),
            ]);

            $proposal = Proposal::query()->create([
                'tenant_id' => $tenantId,
                'proposal_ref' => sprintf('DPRP-%04d', $i),
                'proposal_title' => 'Demo proposal '.$i,
                'proposed_at' => now()->subDays($i)->toDateString(),
                'expires_at' => now()->addDays(10)->toDateString(),
                'lead_id' => $lead->id,
                'customer_id' => $customer->id,
                'biller_id' => $biller->id,
                'biller_name' => $biller->name,
                'recipient_name' => $customer->name,
                'status' => 'Sent',
                'discount_type' => 'none',
                'discount_basis' => 'percent',
                'discount_value' => 0,
                'total_amount' => 1000 + ($i * 50),
                'client_note' => 'Demo proposal note',
                'terms_and_conditions' => 'Demo proposal terms',
                'quotation_id' => $quotation->id,
            ]);

            ProposalItem::query()->create([
                'proposal_id' => $proposal->id,
                'product_id' => $proposalProduct->id,
                'product_name' => $proposalProduct->name,
                'description' => 'Demo proposal line',
                'quantity' => 2 + $i,
                'unit_price' => 50.00,
                'tax_percent' => 0,
                'line_total' => round((2 + $i) * 50, 2),
                'position' => 1,
            ]);
        }
    }

    /** @param Collection<int, StoreManager> $stores * @param Collection<int, Product> $products */
    private function seedStockAdjustments(int $tenantId, ?int $userId, Collection $stores, Collection $products): void
    {
        for ($i = 1; $i <= self::ROWS; $i++) {
            $store = $stores[($i - 1) % $stores->count()];
            $product = $products[($i - 1) % $products->count()];
            $qtyBefore = 15 + $i;
            $delta = ($i % 2 === 0) ? 3 : -2;

            StockAdjustment::query()->create([
                'tenant_id' => $tenantId,
                'product_id' => $product->id,
                'store_id' => $store->id,
                'type' => $delta > 0 ? 'increase' : 'decrease',
                'quantity' => abs($delta),
                'qty_before' => $qtyBefore,
                'qty_after' => max(0, $qtyBefore + $delta),
                'reference' => sprintf('DADJ-%04d', $i),
                'notes' => 'Demo stock adjustment',
                'created_by_user_id' => $userId,
            ]);
        }
    }

    /** @param Collection<int, StoreManager> $stores * @param Collection<int, Product> $products */
    private function seedStockTransfers(int $tenantId, Collection $stores, Collection $products): void
    {
        for ($i = 1; $i <= self::ROWS; $i++) {
            $from = $stores[($i - 1) % $stores->count()];
            $to = $stores[$i % $stores->count()];
            if ($from->id === $to->id) {
                $to = $stores[($i + 1) % $stores->count()];
            }
            $product = $products[($i - 1) % $products->count()];

            $transfer = StockTransfer::query()->create([
                'tenant_id' => $tenantId,
                'from_store_id' => $from->id,
                'to_store_id' => $to->id,
                'ref_number' => sprintf('DTR-%04d', $i),
                'notes' => 'Demo transfer',
            ]);

            StockTransferLine::query()->create([
                'stock_transfer_id' => $transfer->id,
                'product_id' => $product->id,
                'qty' => 1 + ($i % 4),
            ]);
        }
    }

    /** @param Collection<int, StoreManager> $stores * @param Collection<int, Customer> $customers * @param Collection<int, Product> $products */
    private function seedPosOrders(int $tenantId, ?int $userId, Collection $stores, Collection $customers, Collection $products): Collection
    {
        $rows = collect();
        for ($i = 1; $i <= self::ROWS; $i++) {
            $store = $stores[($i - 1) % $stores->count()];
            $customer = $customers[($i - 1) % $customers->count()];
            $product = $products[($i - 1) % $products->count()];
            $qty = 1 + ($i % 3);
            $unit = 80.00;
            $lineTotal = round($qty * $unit, 2);

            $order = PosOrder::query()->create([
                'tenant_id' => $tenantId,
                'store_id' => $store->id,
                'order_no' => sprintf('DPOS-%04d', $i),
                'status' => PosOrder::STATUS_COMPLETED,
                'customer_id' => $customer->id,
                'customer_name' => $customer->name,
                'customer_email' => $customer->email,
                'subtotal_amount' => $lineTotal,
                'tax_amount' => 0,
                'discount_amount' => 0,
                'total_amount' => $lineTotal,
                'tendered_amount' => $lineTotal,
                'change_amount' => 0,
                'currency' => 'KES',
                'created_by' => $userId,
                'completed_at' => now()->subDays(self::ROWS - $i),
                'notes' => 'Demo POS order',
            ]);

            PosOrderItem::query()->create([
                'tenant_id' => $tenantId,
                'pos_order_id' => $order->id,
                'product_id' => $product->id,
                'sku' => $product->sku,
                'product_name' => $product->name,
                'description' => 'Demo POS item',
                'quantity' => $qty,
                'unit_price' => $unit,
                'tax_percent' => 0,
                'line_total' => $lineTotal,
                'position' => 1,
            ]);

            PosOrderPayment::query()->create([
                'tenant_id' => $tenantId,
                'pos_order_id' => $order->id,
                'method' => PosOrderPayment::METHOD_CASH,
                'amount' => $lineTotal,
                'transaction_ref' => sprintf('DPOSP-%04d', $i),
                'paid_at' => now()->subDays(self::ROWS - $i),
                'notes' => 'Demo POS payment',
            ]);

            $rows->push($order);
        }

        return $rows;
    }

    /** @param Collection<int, Customer> $customers * @param Collection<int, StoreManager> $stores * @param Collection<int, Product> $products * @param Collection<int, Invoice> $invoices * @param Collection<int, PosOrder> $posOrders */
    private function seedSalesReturns(
        int $tenantId,
        ?int $userId,
        Collection $customers,
        Collection $stores,
        Collection $products,
        Collection $invoices,
        Collection $posOrders
    ): void {
        for ($i = 1; $i <= 5; $i++) {
            $customer = $customers[($i - 1) % $customers->count()];
            $store = $stores[($i - 1) % $stores->count()];
            $product = $products[($i - 1) % $products->count()];
            $invoice = $invoices[($i - 1) % $invoices->count()];
            $posOrder = $posOrders[($i - 1) % $posOrders->count()];
            $qty = 1 + ($i % 2);
            $unitPrice = round((float) ($product->selling_price ?? 0), 2);
            $total = round($qty * $unitPrice, 2);
            $paid = $i % 2 === 0 ? $total : round($total * 0.4, 2);

            $sr = SalesReturn::query()->create([
                'tenant_id' => $tenantId,
                'sales_return_no' => sprintf('DSR-%04d', $i),
                'invoice_id' => $invoice->id,
                'pos_order_id' => $posOrder->id,
                'product_id' => $product->id,
                'store_id' => $store->id,
                'customer_id' => $customer->id,
                'product_name' => $product->name,
                'quantity' => $qty,
                'returned_at' => now()->subDays($i)->toDateTimeString(),
                'status' => $i % 2 === 0 ? 'Received' : 'Pending',
                'total_amount' => $total,
                'amount_paid' => $paid,
                'amount_due' => round($total - $paid, 2),
                'payment_status' => $paid >= $total ? 'Paid' : 'Unpaid',
                'notes' => 'Demo sales return '.$i,
                'created_by' => $userId,
            ]);

            SalesReturnLine::query()->create([
                'tenant_id' => $tenantId,
                'sales_return_id' => $sr->id,
                'product_id' => $product->id,
                'store_id' => $store->id,
                'quantity' => $qty,
                'unit_price' => $unitPrice,
                'line_total' => $total,
                'product_name' => $product->name,
            ]);
        }
    }
}
