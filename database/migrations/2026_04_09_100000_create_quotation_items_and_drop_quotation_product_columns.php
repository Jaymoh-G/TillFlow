<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('quotation_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('quotation_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->nullable()->constrained()->nullOnDelete();
            $table->string('product_name');
            $table->string('product_image_url', 2048)->nullable();
            $table->decimal('quantity', 12, 3);
            $table->decimal('unit_price', 12, 2);
            $table->decimal('line_total', 12, 2);
            $table->unsignedInteger('position')->default(0);
            $table->timestamps();

            $table->index(['quotation_id', 'position']);
        });

        if (Schema::hasTable('quotations')) {
            $quotations = DB::table('quotations')->orderBy('id')->get();
            foreach ($quotations as $row) {
                $productId = property_exists($row, 'product_id') ? $row->product_id : null;
                DB::table('quotation_items')->insert([
                    'quotation_id' => $row->id,
                    'product_id' => $productId,
                    'product_name' => $row->product_name ?? 'Item',
                    'product_image_url' => $row->product_image_url ?? null,
                    'quantity' => '1.000',
                    'unit_price' => $row->total_amount,
                    'line_total' => $row->total_amount,
                    'position' => 0,
                    'created_at' => $row->created_at ?? now(),
                    'updated_at' => $row->updated_at ?? now(),
                ]);
            }
        }

        Schema::table('quotations', function (Blueprint $table): void {
            if (Schema::hasColumn('quotations', 'product_id')) {
                $table->dropForeign(['product_id']);
            }
        });

        Schema::table('quotations', function (Blueprint $table): void {
            $drop = [];
            foreach (['product_id', 'product_name', 'product_image_url'] as $col) {
                if (Schema::hasColumn('quotations', $col)) {
                    $drop[] = $col;
                }
            }
            if ($drop !== []) {
                $table->dropColumn($drop);
            }
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('quotation_items');

        Schema::table('quotations', function (Blueprint $table): void {
            $table->foreignId('product_id')->nullable()->after('quoted_at')->constrained()->nullOnDelete();
            $table->string('product_name')->default('')->after('product_id');
            $table->string('product_image_url', 2048)->nullable()->after('customer_name');
        });
    }
};
