<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('expense_recurring_rules', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('category_id')->nullable()->constrained('expense_categories')->nullOnDelete();
            $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
            $table->string('title', 255);
            $table->text('description')->nullable();
            $table->string('payee', 255)->nullable();
            $table->decimal('amount', 12, 2);
            $table->string('payment_mode', 32)->default('cash');
            $table->string('payment_status', 32)->default('Unpaid');
            $table->text('notes')->nullable();
            $table->string('cadence', 32)->default('monthly');
            $table->unsignedInteger('interval_value')->default(1);
            $table->date('start_date');
            $table->date('end_date')->nullable();
            $table->dateTime('next_run_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['tenant_id', 'is_active', 'next_run_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('expense_recurring_rules');
    }
};
