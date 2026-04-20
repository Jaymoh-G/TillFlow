<?php

namespace App\Support;

use App\Models\Customer;

final class CustomerCodeGenerator
{
    public static function next(int $tenantId): string
    {
        $codes = Customer::withTrashed()
            ->where('tenant_id', $tenantId)
            ->pluck('code');

        $max = 0;
        foreach ($codes as $code) {
            if (preg_match('/^CU(\d+)$/i', (string) $code, $m)) {
                $max = max($max, (int) $m[1]);
            }
        }

        return 'CU'.str_pad((string) ($max + 1), 3, '0', STR_PAD_LEFT);
    }
}
