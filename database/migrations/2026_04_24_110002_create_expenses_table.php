<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('expenses', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->date('expense_date');
            $table->foreignId('category_id')->nullable()->constrained('expense_categories')->nullOnDelete();
            $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
            $table->string('payee', 255)->nullable();
            $table->string('title', 255);
            $table->text('description')->nullable();
            $table->decimal('amount', 12, 2);
            $table->string('payment_mode', 32)->default('cash');
            $table->string('payment_status', 32)->default('Unpaid');
            $table->string('receipt_path', 1024)->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('recurring_rule_id')->nullable()->constrained('expense_recurring_rules')->nullOnDelete();
            $table->string('recurring_period_key', 80)->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['tenant_id', 'expense_date']);
            $table->index(['tenant_id', 'category_id']);
            $table->index(['tenant_id', 'payment_status', 'payment_mode']);
            $table->unique(['recurring_rule_id', 'recurring_period_key'], 'expenses_recurring_period_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('expenses');
    }
};
