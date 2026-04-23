<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use App\Models\TenantContact;
use App\Services\Tenants\TenantContactService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class TenantContactController extends Controller
{
    public function __construct(
        private readonly TenantContactService $contacts,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $tenant = $this->tenantFromRequest($request);

        $rows = TenantContact::query()
            ->where('tenant_id', $tenant->id)
            ->with('user:id,name,email,avatar_path')
            ->orderByDesc('is_primary')
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->get();

        return response()->json([
            'success' => true,
            'message' => 'Contacts retrieved.',
            'data' => [
                'contacts' => $rows->map(fn (TenantContact $c) => $this->serializeContact($c))->values(),
                'billing' => $this->billingPayload($tenant),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $tenant = $this->tenantFromRequest($request);

        $validated = $request->validate([
            'first_name' => ['required', 'string', 'max:128'],
            'last_name' => ['required', 'string', 'max:128'],
            'position' => ['nullable', 'string', 'max:128'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:64'],
            'is_primary' => ['required', 'boolean'],
            'send_password_setup_email' => ['sometimes', 'boolean'],
            'password' => ['nullable', 'string', 'min:8'],
            'role_ids' => ['nullable', 'array'],
            'role_ids.*' => ['integer'],
            'avatar' => ['nullable', 'file', 'image', 'max:5120'],
        ]);

        try {
            $contact = $this->contacts->createContact($tenant, [
                'first_name' => $validated['first_name'],
                'last_name' => $validated['last_name'],
                'position' => $validated['position'] ?? null,
                'email' => $validated['email'] ?? null,
                'phone' => $validated['phone'] ?? null,
                'is_primary' => $validated['is_primary'],
                'send_password_setup_email' => $request->boolean('send_password_setup_email'),
                'password' => $validated['password'] ?? null,
                'role_ids' => $validated['role_ids'] ?? null,
            ], $request->file('avatar'));
        } catch (ValidationException $e) {
            return $this->validationErrorResponse($e);
        }

        return response()->json([
            'success' => true,
            'message' => 'Contact created.',
            'data' => [
                'contact' => $this->serializeContact($contact),
                'billing' => $this->billingPayload($tenant->fresh()),
            ],
        ], 201);
    }

    public function update(Request $request, string $contact): JsonResponse
    {
        $tenant = $this->tenantFromRequest($request);
        $model = $this->resolveContact($tenant, $contact);

        $validated = $request->validate([
            'first_name' => ['sometimes', 'string', 'max:128'],
            'last_name' => ['sometimes', 'string', 'max:128'],
            'position' => ['nullable', 'string', 'max:128'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:64'],
            'is_primary' => ['sometimes', 'boolean'],
            'avatar' => ['nullable', 'file', 'image', 'max:5120'],
        ]);

        try {
            $updated = $this->contacts->updateContact($model, $validated, $request->file('avatar'));
        } catch (ValidationException $e) {
            return $this->validationErrorResponse($e);
        }

        return response()->json([
            'success' => true,
            'message' => 'Contact updated.',
            'data' => [
                'contact' => $this->serializeContact($updated),
                'billing' => $this->billingPayload($tenant->fresh()),
            ],
        ]);
    }

    public function destroy(Request $request, string $contact): JsonResponse
    {
        $tenant = $this->tenantFromRequest($request);
        $model = $this->resolveContact($tenant, $contact);

        $this->contacts->deleteContact($model);

        return response()->json([
            'success' => true,
            'message' => 'Contact deleted.',
            'data' => [
                'billing' => $this->billingPayload($tenant->fresh()),
            ],
        ]);
    }

    private function tenantFromRequest(Request $request): Tenant
    {
        $routeTenant = $request->route('tenant');
        if ($routeTenant instanceof Tenant) {
            return $routeTenant;
        }

        // Platform routes use `/platform/tenants/{tenant}/contacts` with a numeric id. Implicit
        // model binding only runs when the controller action type-hints `Tenant`, so the route
        // parameter is often a raw string here — resolve it explicitly.
        if (is_numeric($routeTenant)) {
            $tenant = Tenant::query()->find((int) $routeTenant);
            if ($tenant !== null) {
                return $tenant;
            }
        }

        $t = $request->attributes->get('tenant');
        if ($t instanceof Tenant) {
            return $t;
        }

        abort(404);
    }

    private function resolveContact(Tenant $tenant, string $contactId): TenantContact
    {
        $id = (int) $contactId;
        $c = TenantContact::query()
            ->where('tenant_id', $tenant->id)
            ->where('id', $id)
            ->first();
        if (! $c) {
            abort(404);
        }

        return $c;
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeContact(TenantContact $c): array
    {
        $c->loadMissing('user:id,name,email,avatar_path');

        return [
            'id' => $c->id,
            'tenant_id' => $c->tenant_id,
            'first_name' => $c->first_name,
            'last_name' => $c->last_name,
            'display_name' => $c->displayName(),
            'position' => $c->position,
            'email' => $c->email,
            'phone' => $c->phone,
            'avatar_url' => $c->avatar_path ? Storage::disk('public')->url($c->avatar_path) : null,
            'is_primary' => (bool) $c->is_primary,
            'user_id' => $c->user_id,
            'user' => $c->user ? [
                'id' => $c->user->id,
                'name' => $c->user->name,
                'email' => $c->user->email,
                'avatar_url' => $c->user->avatar_path ? Storage::disk('public')->url($c->user->avatar_path) : null,
            ] : null,
        ];
    }

    /**
     * @return array{billing_email: ?string, billing_phone: ?string}
     */
    private function billingPayload(Tenant $tenant): array
    {
        $primary = TenantContact::query()
            ->where('tenant_id', $tenant->id)
            ->where('is_primary', true)
            ->first();

        return [
            'billing_email' => $primary?->email,
            'billing_phone' => $primary?->phone ?? $tenant->company_phone,
        ];
    }

    private function validationErrorResponse(ValidationException $e): JsonResponse
    {
        $first = collect($e->errors())->flatten()->first();

        return response()->json([
            'success' => false,
            'message' => is_string($first) ? $first : 'Validation failed.',
            'data' => ['errors' => $e->errors()],
        ], 422);
    }
}
