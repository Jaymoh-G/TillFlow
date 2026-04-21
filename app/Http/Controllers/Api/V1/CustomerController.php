<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Tenant;
use App\Services\ActivityLogWriter;
use App\Support\ActivityLogProperties;
use App\Support\CustomerCodeGenerator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class CustomerController extends Controller
{
    public function __construct(
        private readonly ActivityLogWriter $activityLogWriter
    ) {}

    public function index(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $customers = Customer::query()
            ->where('tenant_id', $tenant->id)
            ->orderBy('code')
            ->get([
                'id',
                'code',
                'name',
                'email',
                'company',
                'tax_id',
                'category',
                'phone',
                'location',
                'status',
                'avatar_url',
                'created_at',
                'updated_at',
            ]);

        return response()->json([
            'message' => 'Customers retrieved.',
            'customers' => $customers,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        if ($request->has('phone')) {
            $request->merge(['phone' => trim((string) $request->input('phone'))]);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => [
                'required',
                'string',
                'email',
                'max:255',
                Rule::unique('customers', 'email')->where(fn ($q) => $q->where('tenant_id', $tenant->id)),
            ],
            'company' => ['nullable', 'string', 'max:255'],
            'tax_id' => ['nullable', 'string', 'max:255'],
            'category' => ['nullable', 'string', 'max:255'],
            'phone' => [
                'required',
                'string',
                'max:64',
                Rule::unique('customers', 'phone')->where(fn ($q) => $q->where('tenant_id', $tenant->id)),
            ],
            'location' => ['nullable', 'string', 'max:255'],
            'status' => ['required', 'string', Rule::in(['Active', 'Inactive'])],
            'created_at' => ['nullable', 'date'],
            'avatar' => ['nullable', 'file', 'image', 'max:2048'],
            'avatar_url' => ['nullable', 'string', 'max:2048'],
        ]);

        $email = $this->normalizeOptionalString($validated['email'] ?? null);
        $company = $this->normalizeOptionalString($validated['company'] ?? null);
        $taxId = $this->normalizeOptionalString($validated['tax_id'] ?? null);
        $category = $this->normalizeOptionalString($validated['category'] ?? null);
        $location = $this->normalizeOptionalString($validated['location'] ?? null);

        $avatarUrl = $validated['avatar_url'] ?? null;
        if ($request->hasFile('avatar')) {
            /** @var UploadedFile $file */
            $file = $request->file('avatar');
            $path = $file->store('customers/avatars', 'public');
            $avatarUrl = $path ? Storage::disk('public')->url($path) : $avatarUrl;
        }

        $code = CustomerCodeGenerator::next($tenant->id);

        $customer = Customer::query()->create([
            'tenant_id' => $tenant->id,
            'code' => $code,
            'name' => $validated['name'],
            'email' => $email,
            'company' => $company,
            'tax_id' => $taxId,
            'category' => $category,
            'phone' => $validated['phone'],
            'location' => $location,
            'status' => $validated['status'],
            'avatar_url' => $avatarUrl,
            'created_at' => $validated['created_at'] ?? null,
        ]);

        $this->activityLogWriter->record(
            $tenant,
            $request->user(),
            'customer.created',
            $customer,
            ActivityLogProperties::customer($customer),
            $request
        );

        return response()->json([
            'message' => 'Customer created.',
            'customer' => $customer->only([
                'id',
                'code',
                'name',
                'email',
                'company',
                'tax_id',
                'category',
                'phone',
                'location',
                'status',
                'avatar_url',
                'tenant_id',
                'created_at',
                'updated_at',
            ]),
        ], 201);
    }

    public function show(Request $request, string $customer): JsonResponse
    {
        $model = $this->resolveCustomer($request, $customer);

        return response()->json([
            'message' => 'Customer retrieved.',
            'customer' => $model->only([
                'id',
                'code',
                'name',
                'email',
                'company',
                'tax_id',
                'category',
                'phone',
                'location',
                'status',
                'avatar_url',
                'tenant_id',
                'created_at',
                'updated_at',
            ]),
        ]);
    }

    public function update(Request $request, string $customer): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        $model = $this->resolveCustomer($request, $customer);

        if ($request->has('phone')) {
            $request->merge(['phone' => trim((string) $request->input('phone'))]);
        }

        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'email' => [
                'sometimes',
                'nullable',
                'string',
                'email',
                'max:255',
                Rule::unique('customers', 'email')
                    ->where(fn ($q) => $q->where('tenant_id', $tenant->id))
                    ->ignore($model->id),
            ],
            'company' => ['sometimes', 'nullable', 'string', 'max:255'],
            'tax_id' => ['sometimes', 'nullable', 'string', 'max:255'],
            'category' => ['sometimes', 'nullable', 'string', 'max:255'],
            'phone' => [
                'sometimes',
                'required',
                'string',
                'max:64',
                Rule::unique('customers', 'phone')
                    ->where(fn ($q) => $q->where('tenant_id', $tenant->id))
                    ->ignore($model->id),
            ],
            'location' => ['sometimes', 'nullable', 'string', 'max:255'],
            'status' => ['sometimes', 'required', 'string', Rule::in(['Active', 'Inactive'])],
            'avatar' => ['sometimes', 'nullable', 'file', 'image', 'max:2048'],
            'avatar_url' => ['sometimes', 'nullable', 'string', 'max:2048'],
        ]);

        if (array_key_exists('email', $validated)) {
            $validated['email'] = $this->normalizeOptionalString($validated['email']);
        }
        if (array_key_exists('company', $validated)) {
            $validated['company'] = $this->normalizeOptionalString($validated['company']);
        }
        if (array_key_exists('location', $validated)) {
            $validated['location'] = $this->normalizeOptionalString($validated['location']);
        }
        if (array_key_exists('tax_id', $validated)) {
            $validated['tax_id'] = $this->normalizeOptionalString($validated['tax_id']);
        }
        if (array_key_exists('category', $validated)) {
            $validated['category'] = $this->normalizeOptionalString($validated['category']);
        }

        if ($request->hasFile('avatar')) {
            /** @var UploadedFile $file */
            $file = $request->file('avatar');
            $path = $file->store('customers/avatars', 'public');
            if ($path) {
                $validated['avatar_url'] = Storage::disk('public')->url($path);
            }
        }

        unset($validated['avatar']);

        $model->fill($validated);
        $model->save();

        $this->activityLogWriter->record(
            $tenant,
            $request->user(),
            'customer.updated',
            $model,
            ActivityLogProperties::customer($model),
            $request
        );

        return response()->json([
            'message' => 'Customer updated.',
            'customer' => $model->only([
                'id',
                'code',
                'name',
                'email',
                'company',
                'tax_id',
                'category',
                'phone',
                'location',
                'status',
                'avatar_url',
                'tenant_id',
                'created_at',
                'updated_at',
            ]),
        ]);
    }

    public function destroy(Request $request, string $customer): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        $model = $this->resolveCustomer($request, $customer);

        $this->activityLogWriter->record(
            $tenant,
            $request->user(),
            'customer.deleted',
            $model,
            ActivityLogProperties::customer($model),
            $request
        );

        $model->delete();

        return response()->json([
            'message' => 'Customer deleted.',
        ]);
    }

    private function resolveCustomer(Request $request, string $customerId): Customer
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        return Customer::query()
            ->where('tenant_id', $tenant->id)
            ->whereKey($customerId)
            ->firstOrFail();
    }

    private function normalizeOptionalString(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $trimmed = trim($value);

        return $trimmed === '' ? null : $trimmed;
    }
}
