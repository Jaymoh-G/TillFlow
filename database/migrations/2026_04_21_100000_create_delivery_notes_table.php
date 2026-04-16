<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('delivery_notes', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('delivery_note_no', 64);
            $table->foreignId('invoice_id')->constrained('invoices')->cascadeOnDelete();
            $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
            $table->date('issued_at');
            $table->string('status', 32)->default('Issued');
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['tenant_id', 'delivery_note_no']);
            $table->index(['tenant_id', 'invoice_id']);
            $table->index(['tenant_id', 'customer_id']);
            $table->index(['tenant_id', 'status']);
            $table->index(['tenant_id', 'issued_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('delivery_notes');
    }
};
