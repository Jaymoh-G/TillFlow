<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use App\Support\TenantAutomationSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TenantUiSettingsController extends Controller
{
    private const MAX_JSON_BYTES = 524288;

    public function show(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        return response()->json([
            'message' => 'UI settings retrieved.',
            'settings' => $tenant->ui_settings ?? [],
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $validated = $request->validate(array_merge([
            'merge' => ['required', 'array'],
            'merge.website' => ['sometimes', 'array'],
            'merge.app' => ['sometimes', 'array'],
            'merge.system' => ['sometimes', 'array'],
            'merge.notifications' => ['sometimes', 'array'],
        ], $this->automationValidationRules($request)));

        $current = is_array($tenant->ui_settings) ? $tenant->ui_settings : [];
        $merged = $this->deepMerge($current, $validated['merge']);
        if (isset($merged['system']['automation']) && is_array($merged['system']['automation'])) {
            $merged['system']['automation'] = TenantAutomationSettings::normalize($merged['system']['automation']);
        }
        $this->assertWithinSizeLimit($merged);

        $tenant->ui_settings = $merged;
        $tenant->save();

        return response()->json([
            'message' => 'UI settings updated.',
            'settings' => $merged,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function automationValidationRules(Request $request): array
    {
        $merge = $request->input('merge');
        if (! is_array($merge) || ! isset($merge['system']['automation']) || ! is_array($merge['system']['automation'])) {
            return [];
        }

        return [
            'merge.system.automation' => ['sometimes', 'array'],
            'merge.system.automation.dueReminderDaysBefore' => ['sometimes', 'integer', 'min:0', 'max:365'],
            'merge.system.automation.overdueFirstNoticeDaysAfterDue' => ['sometimes', 'integer', 'min:0', 'max:365'],
            'merge.system.automation.overdueResendEveryDays' => ['sometimes', 'integer', 'min:0', 'max:365'],
            'merge.system.automation.runHourLocal' => ['sometimes', 'integer', 'min:0', 'max:23'],
            'merge.system.automation.timezone' => ['sometimes', 'string', 'max:64'],
            'merge.system.automation.quoteExpiryReminderDaysBefore' => ['sometimes', 'integer', 'min:0', 'max:365'],
            'merge.system.automation.proposalExpiryReminderDaysBefore' => ['sometimes', 'integer', 'min:0', 'max:365'],
            'merge.system.automation.quoteDefaultValidDays' => ['sometimes', 'integer', 'min:1', 'max:3650'],
            'merge.system.automation.proposalDefaultValidDays' => ['sometimes', 'integer', 'min:1', 'max:3650'],
            'merge.system.automation.invoiceDefaultDueDays' => ['sometimes', 'integer', 'min:1', 'max:3650'],
            'merge.system.automation.invoiceDueReminderChannels' => ['sometimes', 'array'],
            'merge.system.automation.invoiceDueReminderChannels.email' => ['sometimes', 'boolean'],
            'merge.system.automation.invoiceDueReminderChannels.sms' => ['sometimes', 'boolean'],
            'merge.system.automation.invoiceOverdueChannels' => ['sometimes', 'array'],
            'merge.system.automation.invoiceOverdueChannels.email' => ['sometimes', 'boolean'],
            'merge.system.automation.invoiceOverdueChannels.sms' => ['sometimes', 'boolean'],
            'merge.system.automation.quoteExpiryReminderChannels' => ['sometimes', 'array'],
            'merge.system.automation.quoteExpiryReminderChannels.email' => ['sometimes', 'boolean'],
            'merge.system.automation.quoteExpiryReminderChannels.sms' => ['sometimes', 'boolean'],
            'merge.system.automation.proposalExpiryReminderChannels' => ['sometimes', 'array'],
            'merge.system.automation.proposalExpiryReminderChannels.email' => ['sometimes', 'boolean'],
            'merge.system.automation.proposalExpiryReminderChannels.sms' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * @param  array<string, mixed>  $base
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function deepMerge(array $base, array $overrides): array
    {
        foreach ($overrides as $key => $value) {
            if (is_array($value) && isset($base[$key]) && is_array($base[$key])) {
                $base[$key] = $this->deepMerge($base[$key], $value);
            } else {
                $base[$key] = $value;
            }
        }

        return $base;
    }

    /**
     * @param  array<string, mixed>  $settings
     */
    private function assertWithinSizeLimit(array $settings): void
    {
        $encoded = json_encode($settings);
        if ($encoded === false || strlen($encoded) > self::MAX_JSON_BYTES) {
            abort(422, 'UI settings payload too large.');
        }
    }
}
