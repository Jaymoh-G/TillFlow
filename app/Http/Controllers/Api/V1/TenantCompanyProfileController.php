<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TenantCompanyProfileController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        $tenant->loadMissing('primaryContact');

        return response()->json([
            'message' => 'Company profile retrieved.',
            'profile' => $this->serializeProfile($tenant),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'company_email' => ['required', 'email', 'max:255'],
            'company_phone' => ['required', 'string', 'max:64'],
            'company_website' => ['nullable', 'string', 'max:512'],
            'company_address_line' => ['required', 'string', 'max:2000'],
            'quotation_footer_payment_line' => ['nullable', 'string', 'max:5000'],
            'quotation_footer_bank_line' => ['nullable', 'string', 'max:5000'],
            'quotation_footer_closing_line' => ['nullable', 'string', 'max:5000'],
        ]);

        $website = isset($validated['company_website']) ? trim((string) $validated['company_website']) : null;
        if ($website === '') {
            $website = null;
        }

        $trimText = static function (?string $v): ?string {
            if ($v === null) {
                return null;
            }
            $t = trim($v);

            return $t === '' ? null : $t;
        };

        $tenant->fill([
            'name' => trim($validated['name']),
            'company_email' => trim($validated['company_email']),
            'company_phone' => trim($validated['company_phone']),
            'company_fax' => null,
            'company_website' => $website,
            'company_address_line' => trim($validated['company_address_line']),
            'company_country' => null,
            'company_state' => null,
            'company_city' => null,
            'company_postal_code' => null,
            'quotation_footer_payment_line' => $trimText($validated['quotation_footer_payment_line'] ?? null),
            'quotation_footer_bank_line' => $trimText($validated['quotation_footer_bank_line'] ?? null),
            'quotation_footer_closing_line' => $trimText($validated['quotation_footer_closing_line'] ?? null),
        ]);
        $tenant->save();

        return response()->json([
            'message' => 'Company profile updated.',
            'profile' => $this->serializeProfile($tenant->fresh()),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeProfile(Tenant $tenant): array
    {
        $primary = $tenant->relationLoaded('primaryContact') ? $tenant->primaryContact : $tenant->primaryContact()->first();

        return [
            'name' => $tenant->name,
            'company_email' => $tenant->company_email,
            'company_phone' => $tenant->company_phone,
            'billing_email' => $primary?->email ?? $tenant->company_email,
            'billing_phone' => $primary?->phone ?? $tenant->company_phone,
            'company_fax' => $tenant->company_fax,
            'company_website' => $tenant->company_website,
            'company_address_line' => $tenant->company_address_line,
            'company_country' => $tenant->company_country,
            'company_state' => $tenant->company_state,
            'company_city' => $tenant->company_city,
            'company_postal_code' => $tenant->company_postal_code,
            'quotation_footer_payment_line' => $tenant->quotation_footer_payment_line,
            'quotation_footer_bank_line' => $tenant->quotation_footer_bank_line,
            'quotation_footer_closing_line' => $tenant->quotation_footer_closing_line,
        ];
    }
}
