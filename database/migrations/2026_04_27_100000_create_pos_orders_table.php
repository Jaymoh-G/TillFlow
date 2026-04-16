<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pos_orders', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();

            $table->string('order_no', 32);
            $table->string('status', 24)->default('Completed');

            $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
            $table->string('customer_name')->nullable();
            $table->string('customer_email')->nullable();

            $table->decimal('subtotal_amount', 12, 2)->default(0);
            $table->decimal('tax_amount', 12, 2)->default(0);
            $table->decimal('discount_amount', 12, 2)->default(0);
            $table->decimal('total_amount', 12, 2)->default(0);

            $table->decimal('tendered_amount', 12, 2)->default(0);
            $table->decimal('change_amount', 12, 2)->default(0);

            $table->string('currency', 8)->default('KES');

            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('voided_at')->nullable();
            $table->text('notes')->nullable();

            $table->timestamp('sent_to_customer_at')->nullable();

            $table->timestamps();

            $table->unique(['tenant_id', 'order_no']);
            $table->index(['tenant_id', 'status']);
            $table->index(['tenant_id', 'completed_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pos_orders');
    }
};
