<?php

namespace App\Support;

use App\Models\Tenant;

/**
 * @phpstan-type ChannelShape array{email: bool, sms: bool}
 * @phpstan-type AutomationShape array{
 *   dueReminderDaysBefore: int,
 *   overdueFirstNoticeDaysAfterDue: int,
 *   overdueResendEveryDays: int,
 *   runHourLocal: int,
 *   timezone: string,
 *   quoteExpiryReminderDaysBefore: int,
 *   proposalExpiryReminderDaysBefore: int,
 *   quoteDefaultValidDays: int,
 *   proposalDefaultValidDays: int,
 *   invoiceDefaultDueDays: int,
 *   invoiceDueReminderChannels: ChannelShape,
 *   invoiceOverdueChannels: ChannelShape,
 *   quoteExpiryReminderChannels: ChannelShape,
 *   proposalExpiryReminderChannels: ChannelShape
 * }
 */
class TenantAutomationSettings
{
    /**
     * @return AutomationShape
     */
    public static function defaults(): array
    {
        return [
            'dueReminderDaysBefore' => 3,
            'overdueFirstNoticeDaysAfterDue' => 1,
            'overdueResendEveryDays' => 7,
            'runHourLocal' => 8,
            'timezone' => 'UTC',
            'quoteExpiryReminderDaysBefore' => 3,
            'proposalExpiryReminderDaysBefore' => 3,
            'quoteDefaultValidDays' => 30,
            'proposalDefaultValidDays' => 30,
            'invoiceDefaultDueDays' => 21,
            'invoiceDueReminderChannels' => ['email' => true, 'sms' => false],
            'invoiceOverdueChannels' => ['email' => true, 'sms' => false],
            'quoteExpiryReminderChannels' => ['email' => true, 'sms' => false],
            'proposalExpiryReminderChannels' => ['email' => true, 'sms' => false],
        ];
    }

    /**
     * @return AutomationShape
     */
    public static function forTenant(?Tenant $tenant): array
    {
        $raw = [];
        if ($tenant && is_array($tenant->ui_settings)) {
            $sys = $tenant->ui_settings['system'] ?? null;
            if (is_array($sys) && isset($sys['automation']) && is_array($sys['automation'])) {
                $raw = $sys['automation'];
            }
        }

        return self::normalize($raw);
    }

    /**
     * @param  array<string, mixed>  $raw
     * @return AutomationShape
     */
    public static function normalize(array $raw): array
    {
        $d = self::defaults();

        $ch = static function (mixed $v, array $def): array {
            if (! is_array($v)) {
                return $def;
            }

            return [
                'email' => array_key_exists('email', $v) ? (bool) $v['email'] : $def['email'],
                'sms' => array_key_exists('sms', $v) ? (bool) $v['sms'] : $def['sms'],
            ];
        };

        return [
            'dueReminderDaysBefore' => self::intBound($raw['dueReminderDaysBefore'] ?? $d['dueReminderDaysBefore'], 0, 365),
            'overdueFirstNoticeDaysAfterDue' => self::intBound($raw['overdueFirstNoticeDaysAfterDue'] ?? $d['overdueFirstNoticeDaysAfterDue'], 0, 365),
            'overdueResendEveryDays' => self::intBound($raw['overdueResendEveryDays'] ?? $d['overdueResendEveryDays'], 0, 365),
            'runHourLocal' => self::intBound($raw['runHourLocal'] ?? $d['runHourLocal'], 0, 23),
            'timezone' => self::timezone($raw['timezone'] ?? $d['timezone']),
            'quoteExpiryReminderDaysBefore' => self::intBound($raw['quoteExpiryReminderDaysBefore'] ?? $d['quoteExpiryReminderDaysBefore'], 0, 365),
            'proposalExpiryReminderDaysBefore' => self::intBound($raw['proposalExpiryReminderDaysBefore'] ?? $d['proposalExpiryReminderDaysBefore'], 0, 365),
            'quoteDefaultValidDays' => max(1, self::intBound($raw['quoteDefaultValidDays'] ?? $d['quoteDefaultValidDays'], 1, 3650)),
            'proposalDefaultValidDays' => max(1, self::intBound($raw['proposalDefaultValidDays'] ?? $d['proposalDefaultValidDays'], 1, 3650)),
            'invoiceDefaultDueDays' => max(1, self::intBound($raw['invoiceDefaultDueDays'] ?? $d['invoiceDefaultDueDays'], 1, 3650)),
            'invoiceDueReminderChannels' => $ch($raw['invoiceDueReminderChannels'] ?? null, $d['invoiceDueReminderChannels']),
            'invoiceOverdueChannels' => $ch($raw['invoiceOverdueChannels'] ?? null, $d['invoiceOverdueChannels']),
            'quoteExpiryReminderChannels' => $ch($raw['quoteExpiryReminderChannels'] ?? null, $d['quoteExpiryReminderChannels']),
            'proposalExpiryReminderChannels' => $ch($raw['proposalExpiryReminderChannels'] ?? null, $d['proposalExpiryReminderChannels']),
        ];
    }

    private static function intBound(mixed $v, int $min, int $max): int
    {
        $n = is_numeric($v) ? (int) $v : $min;

        return max($min, min($max, $n));
    }

    private static function timezone(mixed $tz): string
    {
        $s = is_string($tz) ? trim($tz) : '';
        if ($s === '') {
            return 'UTC';
        }
        try {
            new \DateTimeZone($s);

            return $s;
        } catch (\Throwable) {
            return 'UTC';
        }
    }
}
