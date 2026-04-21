<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sales_returns', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('sales_return_no', 32);
            if (Schema::hasTable('invoices')) {
                $table->foreignId('invoice_id')->nullable()->constrained('invoices')->nullOnDelete();
            } else {
                $table->unsignedBigInteger('invoice_id')->nullable();
                $table->index('invoice_id');
            }
            $table->foreignId('customer_id')->constrained('customers')->cascadeOnDelete();
            $table->string('product_name');
            $table->dateTime('returned_at');
            $table->string('status', 32)->default('Pending');
            $table->decimal('total_amount', 12, 2);
            $table->decimal('amount_paid', 12, 2)->default(0);
            $table->decimal('amount_due', 12, 2)->default(0);
            $table->string('payment_status', 16);
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['tenant_id', 'sales_return_no']);
            $table->index(['tenant_id', 'returned_at']);
            $table->index(['tenant_id', 'customer_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sales_returns');
    }
};
