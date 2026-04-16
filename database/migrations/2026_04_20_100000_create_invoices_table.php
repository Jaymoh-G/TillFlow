<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('invoices', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();

            $table->string('invoice_ref', 32);
            $table->date('issued_at');
            $table->date('due_at')->nullable();

            $table->foreignId('customer_id')->constrained('customers')->cascadeOnDelete();
            $table->string('customer_name');
            $table->string('customer_image_url', 2048)->nullable();

            $table->string('status', 16)->default('Draft');

            $table->string('discount_type', 16)->default('none');
            $table->string('discount_basis', 16)->default('percent');
            $table->decimal('discount_value', 12, 2)->nullable();

            $table->decimal('total_amount', 12, 2)->default(0);
            $table->decimal('amount_paid', 12, 2)->default(0);

            $table->text('notes')->nullable();
            $table->text('terms_and_conditions')->nullable();

            $table->timestamps();
            $table->softDeletes();

            $table->unique(['tenant_id', 'invoice_ref']);
            $table->index(['tenant_id', 'issued_at']);
            $table->index(['tenant_id', 'status']);
            $table->index(['tenant_id', 'customer_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('invoices');
    }
};
