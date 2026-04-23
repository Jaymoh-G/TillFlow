<?php

namespace App\Services\Search;

use App\Models\Customer;
use App\Models\Invoice;
use App\Models\PosOrder;
use App\Models\Product;
use App\Models\Purchase;
use App\Models\Supplier;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Support\Collection;

class GlobalSearchService
{
    /** @var list<string> */
    public const ENTITY_TYPES = [
        'customers',
        'products',
        'invoices',
        'pos_orders',
        'suppliers',
        'purchases',
        'users',
    ];

    /**
     * @param  list<string>  $entityTypes
     * @return array{query: string, limit: int, groups: list<array{type: string, label: string, total: int, items: list<array<string, mixed>>}>}
     */
    public function search(User $user, Tenant $tenant, string $query, array $entityTypes, int $limitPerEntity): array
    {
        $needle = $this->likeNeedle($query);
        $entityTypes = $this->normalizeEntityTypes($entityTypes);
        $limitPerEntity = max(1, min(15, $limitPerEntity));

        $groups = [];

        foreach ($entityTypes as $type) {
            $items = match ($type) {
                'customers' => $user->hasPermission('sales.customers.view')
                    ? $this->searchCustomers($tenant, $needle, $limitPerEntity)
                    : collect(),
                'products' => $user->hasPermission('catalog.items.view')
                    ? $this->searchProducts($tenant, $needle, $limitPerEntity)
                    : collect(),
                'invoices' => $user->hasPermission('sales.invoices.view')
                    ? $this->searchInvoices($tenant, $needle, $limitPerEntity)
                    : collect(),
                'pos_orders' => $user->hasPermission('sales.orders.view')
                    ? $this->searchPosOrders($user, $tenant, $needle, $limitPerEntity)
                    : collect(),
                'suppliers' => $user->hasPermission('procurement.suppliers.view')
                    ? $this->searchSuppliers($tenant, $needle, $limitPerEntity)
                    : collect(),
                'purchases' => $user->hasPermission('procurement.purchases.view')
                    ? $this->searchPurchases($tenant, $needle, $limitPerEntity)
                    : collect(),
                'users' => $user->hasPermission('users.manage')
                    ? $this->searchUsers($tenant, $needle, $limitPerEntity)
                    : collect(),
                default => collect(),
            };

            $total = (int) $items->count();
            if ($total === 0) {
                continue;
            }

            $groups[] = [
                'type' => $type,
                'label' => $this->labelForType($type),
                'total' => $total,
                'items' => $items->values()->all(),
            ];
        }

        return [
            'query' => $query,
            'limit' => $limitPerEntity,
            'groups' => $groups,
        ];
    }

    /**
     * @param  list<string>  $entityTypes
     * @return list<string>
     */
    private function normalizeEntityTypes(array $entityTypes): array
    {
        $allowed = self::ENTITY_TYPES;
        $filtered = array_values(array_intersect($allowed, $entityTypes));

        return $filtered !== [] ? $filtered : $allowed;
    }

    private function likeNeedle(string $q): string
    {
        return '%'.str_replace(['%', '_'], ['\\%', '\\_'], $q).'%';
    }

    private function labelForType(string $type): string
    {
        return match ($type) {
            'customers' => 'Customers',
            'products' => 'Products',
            'invoices' => 'Invoices',
            'pos_orders' => 'POS orders',
            'suppliers' => 'Suppliers',
            'purchases' => 'Purchases',
            'users' => 'Users',
            default => $type,
        };
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function searchCustomers(Tenant $tenant, string $needle, int $limit): Collection
    {
        return Customer::query()
            ->where('tenant_id', $tenant->id)
            ->where(function ($w) use ($needle): void {
                $w->where('name', 'like', $needle)
                    ->orWhere('email', 'like', $needle)
                    ->orWhere('phone', 'like', $needle)
                    ->orWhere('code', 'like', $needle)
                    ->orWhere('company', 'like', $needle);
            })
            ->orderBy('name')
            ->limit($limit)
            ->get(['id', 'code', 'name', 'email', 'phone'])
            ->map(fn (Customer $c) => [
                'type' => 'customers',
                'id' => $c->id,
                'title' => $c->name,
                'subtitle' => trim(implode(' · ', array_filter([$c->code, $c->email, $c->phone]))),
                'href' => '/admin/customers',
                'meta' => ['customer_id' => $c->id],
            ]);
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function searchProducts(Tenant $tenant, string $needle, int $limit): Collection
    {
        return Product::query()
            ->where('tenant_id', $tenant->id)
            ->where(function ($w) use ($needle): void {
                $w->where('name', 'like', $needle)
                    ->orWhere('sku', 'like', $needle);
            })
            ->orderBy('name')
            ->limit($limit)
            ->get(['id', 'name', 'sku'])
            ->map(fn (Product $p) => [
                'type' => 'products',
                'id' => $p->id,
                'title' => $p->name,
                'subtitle' => $p->sku ? (string) $p->sku : null,
                'href' => '/admin/items/'.$p->id.'/edit',
                'meta' => ['product_id' => $p->id],
            ]);
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function searchInvoices(Tenant $tenant, string $needle, int $limit): Collection
    {
        return Invoice::query()
            ->where('tenant_id', $tenant->id)
            ->where(function ($w) use ($needle): void {
                $w->where('invoice_ref', 'like', $needle)
                    ->orWhere('invoice_title', 'like', $needle)
                    ->orWhere('customer_name', 'like', $needle);
            })
            ->orderByDesc('issued_at')
            ->orderByDesc('id')
            ->limit($limit)
            ->get(['id', 'invoice_ref', 'invoice_title', 'status', 'customer_name'])
            ->map(fn (Invoice $i) => [
                'type' => 'invoices',
                'id' => $i->id,
                'title' => $i->invoice_ref ?: 'Invoice #'.$i->id,
                'subtitle' => trim(implode(' · ', array_filter([$i->invoice_title, $i->customer_name, $i->status]))),
                'href' => '/admin/invoices/'.$i->id,
                'meta' => ['invoice_id' => $i->id],
            ]);
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function searchPosOrders(User $user, Tenant $tenant, string $needle, int $limit): Collection
    {
        $q = PosOrder::query()
            ->where('tenant_id', $tenant->id)
            ->where(function ($w) use ($needle): void {
                $w->where('order_no', 'like', $needle)
                    ->orWhere('customer_name', 'like', $needle)
                    ->orWhere('customer_email', 'like', $needle);
            })
            ->orderByDesc('completed_at')
            ->orderByDesc('id')
            ->limit($limit);

        $allowed = $user->allowed_store_ids ?? null;
        if (is_array($allowed) && $allowed !== []) {
            $q->whereIn('store_id', array_map('intval', $allowed));
        }

        return $q->get(['id', 'order_no', 'status', 'customer_name', 'total_amount', 'currency'])
            ->map(fn (PosOrder $o) => [
                'type' => 'pos_orders',
                'id' => $o->id,
                'title' => $o->order_no ?: 'Order #'.$o->id,
                'subtitle' => trim(implode(' · ', array_filter([
                    $o->customer_name,
                    $o->status,
                    $o->currency.' '.(string) $o->total_amount,
                ]))),
                'href' => '/admin/orders/'.$o->id,
                'meta' => ['pos_order_id' => $o->id],
            ]);
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function searchSuppliers(Tenant $tenant, string $needle, int $limit): Collection
    {
        return Supplier::query()
            ->where('tenant_id', $tenant->id)
            ->where(function ($w) use ($needle): void {
                $w->where('name', 'like', $needle)
                    ->orWhere('code', 'like', $needle)
                    ->orWhere('email', 'like', $needle)
                    ->orWhere('phone', 'like', $needle);
            })
            ->orderBy('name')
            ->limit($limit)
            ->get(['id', 'code', 'name', 'email'])
            ->map(fn (Supplier $s) => [
                'type' => 'suppliers',
                'id' => $s->id,
                'title' => $s->name,
                'subtitle' => trim(implode(' · ', array_filter([$s->code, $s->email]))),
                'href' => '/admin/suppliers',
                'meta' => ['supplier_id' => $s->id],
            ]);
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function searchPurchases(Tenant $tenant, string $needle, int $limit): Collection
    {
        return Purchase::query()
            ->where('tenant_id', $tenant->id)
            ->where(function ($w) use ($needle): void {
                $w->where('reference', 'like', $needle)
                    ->orWhere('description', 'like', $needle);
            })
            ->orderByDesc('purchase_date')
            ->orderByDesc('id')
            ->limit($limit)
            ->get(['id', 'reference', 'status', 'grand_total'])
            ->map(fn (Purchase $p) => [
                'type' => 'purchases',
                'id' => $p->id,
                'title' => $p->reference ?: 'Purchase #'.$p->id,
                'subtitle' => trim(implode(' · ', array_filter([$p->status, (string) $p->grand_total]))),
                'href' => '/admin/purchases/'.$p->id.'/edit',
                'meta' => ['purchase_id' => $p->id],
            ]);
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function searchUsers(Tenant $tenant, string $needle, int $limit): Collection
    {
        return User::query()
            ->where('tenant_id', $tenant->id)
            ->where(function ($w) use ($needle): void {
                $w->where('name', 'like', $needle)
                    ->orWhere('email', 'like', $needle);
            })
            ->orderBy('name')
            ->limit($limit)
            ->get(['id', 'name', 'email'])
            ->map(fn (User $u) => [
                'type' => 'users',
                'id' => $u->id,
                'title' => $u->name,
                'subtitle' => $u->email,
                'href' => '/admin/settings/roles-permissions',
                'meta' => ['user_id' => $u->id],
            ]);
    }
}
