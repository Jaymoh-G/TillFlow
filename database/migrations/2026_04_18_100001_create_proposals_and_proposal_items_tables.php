<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('proposals', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('proposal_ref', 32);
            $table->string('proposal_title')->nullable();
            $table->date('proposed_at');
            $table->date('expires_at')->nullable();
            $table->foreignId('lead_id')->nullable()->constrained('leads')->nullOnDelete();
            $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
            $table->foreignId('biller_id')->nullable()->constrained('billers')->nullOnDelete();
            $table->string('biller_name')->nullable();
            $table->string('recipient_name');
            $table->string('recipient_image_url', 2048)->nullable();
            $table->string('status', 16);
            $table->string('discount_type', 24)->default('none');
            $table->string('discount_basis', 16)->default('percent');
            $table->decimal('discount_value', 12, 2)->nullable();
            $table->decimal('total_amount', 12, 2);
            $table->text('client_note')->nullable();
            $table->text('terms_and_conditions')->nullable();
            $table->foreignId('quotation_id')->nullable()->constrained('quotations')->nullOnDelete();
            $table->timestamp('accepted_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['tenant_id', 'proposal_ref']);
            $table->index(['tenant_id', 'proposed_at']);
            $table->index(['tenant_id', 'status']);
            $table->index(['tenant_id', 'lead_id']);
            $table->index(['tenant_id', 'customer_id']);
        });

        Schema::create('proposal_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('proposal_id')->constrained('proposals')->cascadeOnDelete();
            $table->foreignId('product_id')->nullable()->constrained()->nullOnDelete();
            $table->string('product_name');
            $table->string('product_image_url', 2048)->nullable();
            $table->text('description')->nullable();
            $table->decimal('quantity', 12, 3);
            $table->decimal('unit_price', 12, 2);
            $table->decimal('tax_percent', 6, 2)->default(0);
            $table->decimal('line_total', 12, 2);
            $table->unsignedInteger('position')->default(0);
            $table->timestamps();

            $table->index(['proposal_id', 'position']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('proposal_items');
        Schema::dropIfExists('proposals');
    }
};
