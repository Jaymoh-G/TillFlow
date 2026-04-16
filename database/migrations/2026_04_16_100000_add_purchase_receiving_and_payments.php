<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchases', function (Blueprint $table): void {
            if (! Schema::hasColumn('purchases', 'purchase_type')) {
                $table->string('purchase_type', 24)->default('stock')->after('status');
            }
        });

        Schema::table('purchase_lines', function (Blueprint $table): void {
            if (! Schema::hasColumn('purchase_lines', 'received_qty')) {
                $table->decimal('received_qty', 15, 3)->default(0)->after('qty');
            }
        });

        if (! Schema::hasTable('purchase_receipts')) {
            Schema::create('purchase_receipts', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
                $table->foreignId('purchase_id')->constrained('purchases')->cascadeOnDelete();
                $table->date('received_at');
                $table->string('reference', 120)->nullable();
                $table->text('note')->nullable();
                $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();

                $table->index(['tenant_id', 'purchase_id'], 'pr_tenant_purchase_idx');
            });
        }

        if (! Schema::hasTable('purchase_receipt_lines')) {
            Schema::create('purchase_receipt_lines', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('purchase_receipt_id')->constrained('purchase_receipts')->cascadeOnDelete();
                $table->foreignId('purchase_line_id')->constrained('purchase_lines')->cascadeOnDelete();
                $table->foreignId('product_id')->nullable()->constrained('products')->nullOnDelete();
                $table->decimal('qty_received', 15, 3);
                $table->timestamps();

                $table->index(['purchase_receipt_id', 'purchase_line_id'], 'prl_receipt_line_idx');
            });
        }

        if (! Schema::hasTable('purchase_payments')) {
            Schema::create('purchase_payments', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
                $table->foreignId('purchase_id')->constrained('purchases')->cascadeOnDelete();
                $table->date('paid_at');
                $table->decimal('amount', 15, 2);
                $table->string('method', 40)->default('Cash');
                $table->string('reference', 120)->nullable();
                $table->text('note')->nullable();
                $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();

                $table->index(['tenant_id', 'purchase_id'], 'pp_tenant_purchase_idx');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('purchase_payments');
        Schema::dropIfExists('purchase_receipt_lines');
        Schema::dropIfExists('purchase_receipts');

        Schema::table('purchase_lines', function (Blueprint $table): void {
            if (Schema::hasColumn('purchase_lines', 'received_qty')) {
                $table->dropColumn('received_qty');
            }
        });

        Schema::table('purchases', function (Blueprint $table): void {
            if (Schema::hasColumn('purchases', 'purchase_type')) {
                $table->dropColumn('purchase_type');
            }
        });
    }
};
