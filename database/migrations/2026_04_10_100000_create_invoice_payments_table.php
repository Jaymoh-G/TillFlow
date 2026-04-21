<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('invoice_payments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            if (Schema::hasTable('invoices')) {
                $table->foreignId('invoice_id')->constrained('invoices')->cascadeOnDelete();
            } else {
                $table->unsignedBigInteger('invoice_id');
                $table->index('invoice_id');
            }

            $table->string('receipt_ref', 32);
            $table->decimal('amount', 12, 2);
            $table->string('payment_method', 32);
            $table->timestamp('paid_at');
            $table->text('notes')->nullable();

            $table->timestamps();

            $table->unique(['tenant_id', 'receipt_ref']);
            $table->index(['tenant_id', 'invoice_id']);
            $table->index(['tenant_id', 'paid_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('invoice_payments');
    }
};
