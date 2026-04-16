<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('invoices')) {
            return;
        }

        $driver = Schema::getConnection()->getDriverName();
        if ($driver === 'mysql' || $driver === 'mariadb') {
            DB::statement('ALTER TABLE invoices MODIFY status VARCHAR(32) NOT NULL DEFAULT \'Draft\'');
        } else {
            Schema::table('invoices', function (Blueprint $table): void {
                $table->string('status', 32)->default('Draft')->change();
            });
        }

        $today = now()->toDateString();

        $invoices = DB::table('invoices')->whereNull('deleted_at')->get();

        foreach ($invoices as $inv) {
            $oldStatus = (string) $inv->status;
            $newStatus = $oldStatus;

            if ($oldStatus === 'Sent') {
                $due = $inv->due_at;
                $isOverdue = $due !== null && (string) $due < $today;
                $paid = (float) $inv->amount_paid;
                $total = (float) $inv->total_amount;

                if ($paid + 0.00001 >= $total && $total > 0) {
                    $newStatus = 'Paid';
                } elseif ($paid > 0.00001 && $paid < $total - 0.00001) {
                    $newStatus = 'Partially_paid';
                } elseif ($isOverdue && $paid < 0.00001) {
                    $newStatus = 'Overdue';
                } else {
                    $newStatus = 'Unpaid';
                }
            }

            if ($newStatus !== $oldStatus) {
                DB::table('invoices')->where('id', $inv->id)->update(['status' => $newStatus]);
            }

            $paid = (float) $inv->amount_paid;
            if ($paid > 0.00001) {
                $exists = DB::table('invoice_payments')->where('invoice_id', $inv->id)->exists();
                if (! $exists) {
                    $ref = $this->nextLegacyReceiptRef((int) $inv->tenant_id);
                    DB::table('invoice_payments')->insert([
                        'tenant_id' => $inv->tenant_id,
                        'invoice_id' => $inv->id,
                        'receipt_ref' => $ref,
                        'amount' => number_format($paid, 2, '.', ''),
                        'payment_method' => 'opening_balance',
                        'paid_at' => $inv->updated_at ?? $inv->created_at ?? now(),
                        'notes' => 'Migrated from historical amount_paid',
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
            }
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('invoices') || ! Schema::hasTable('invoice_payments')) {
            return;
        }

        DB::table('invoice_payments')->where('payment_method', 'opening_balance')->delete();

        DB::table('invoices')->whereIn('status', ['Unpaid', 'Partially_paid', 'Paid', 'Overdue'])->update(['status' => 'Sent']);

        $driver = Schema::getConnection()->getDriverName();
        if ($driver === 'mysql' || $driver === 'mariadb') {
            DB::statement('ALTER TABLE invoices MODIFY status VARCHAR(16) NOT NULL DEFAULT \'Draft\'');
        } else {
            Schema::table('invoices', function (Blueprint $table): void {
                $table->string('status', 16)->default('Draft')->change();
            });
        }
    }

    private function nextLegacyReceiptRef(int $tenantId): string
    {
        $last = DB::table('invoice_payments')
            ->where('tenant_id', $tenantId)
            ->where('receipt_ref', 'like', 'RCP-%')
            ->orderByDesc('id')
            ->value('receipt_ref');

        $n = 0;
        if (is_string($last) && preg_match('/^RCP-(\d{1,})$/', $last, $m)) {
            $n = (int) $m[1];
        }

        return 'RCP-'.str_pad((string) ($n + 1), 6, '0', STR_PAD_LEFT);
    }
};
