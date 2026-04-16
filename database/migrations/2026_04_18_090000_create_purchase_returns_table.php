<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('purchase_returns')) {
            Schema::create('purchase_returns', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
                $table->foreignId('supplier_id')->constrained('suppliers')->cascadeOnDelete();
                $table->foreignId('purchase_id')->nullable()->constrained('purchases')->nullOnDelete();
                $table->string('reference', 120);
                $table->date('return_date');
                $table->string('status', 30)->default('Returned');
                $table->decimal('grand_total', 14, 2)->default(0);
                $table->decimal('paid_amount', 14, 2)->default(0);
                $table->decimal('due_amount', 14, 2)->default(0);
                $table->decimal('refund_amount', 14, 2)->default(0);
                $table->string('payment_status', 30)->default('Unpaid');
                $table->text('description')->nullable();
                $table->timestamps();

                $table->unique(['tenant_id', 'reference'], 'prtn_ref_unique');
                $table->index(['tenant_id', 'supplier_id'], 'prtn_tenant_supplier_idx');
            });
        }

        if (! Schema::hasTable('purchase_return_lines')) {
            Schema::create('purchase_return_lines', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('purchase_return_id')->constrained('purchase_returns')->cascadeOnDelete();
                $table->foreignId('purchase_line_id')->constrained('purchase_lines')->cascadeOnDelete();
                $table->foreignId('product_id')->nullable()->constrained('products')->nullOnDelete();
                $table->decimal('qty_returned', 14, 3)->default(0);
                $table->decimal('line_refund_amount', 14, 2)->default(0);
                $table->timestamps();

                $table->index(['purchase_return_id', 'purchase_line_id'], 'prl_return_line_idx');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('purchase_return_lines');
        Schema::dropIfExists('purchase_returns');
    }
};
