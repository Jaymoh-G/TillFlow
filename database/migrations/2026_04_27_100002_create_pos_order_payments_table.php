<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pos_order_payments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('pos_order_id')->constrained('pos_orders')->cascadeOnDelete();

            $table->string('method', 32);
            $table->decimal('amount', 12, 2);
            $table->string('transaction_ref', 64)->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->text('notes')->nullable();

            $table->timestamps();

            $table->index(['tenant_id', 'pos_order_id']);
            $table->index(['tenant_id', 'paid_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pos_order_payments');
    }
};
