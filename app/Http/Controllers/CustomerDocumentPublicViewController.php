<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use App\Models\Proposal;
use App\Models\Quotation;
use App\Models\Tenant;
use App\Services\ActivityLogWriter;
use App\Support\ActivityLogProperties;
use Illuminate\Contracts\View\View;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class CustomerDocumentPublicViewController extends Controller
{
    public function __construct(
        private readonly ActivityLogWriter $activityLogWriter,
    ) {}

    public function show(int $tenant, string $type, int $id): View
    {
        $tenantModel = Tenant::query()->findOrFail($tenant);

        return match ($type) {
            'invoice' => $this->invoiceViewed($tenantModel, $id),
            'quotation' => $this->quotationViewed($tenantModel, $id),
            'proposal' => $this->proposalViewed($tenantModel, $id),
            default => throw new NotFoundHttpException,
        };
    }

    private function invoiceViewed(Tenant $tenant, int $id): View
    {
        $invoice = Invoice::query()
            ->where('tenant_id', $tenant->id)
            ->whereKey($id)
            ->firstOrFail();

        if ($invoice->sent_to_customer_at === null) {
            abort(404);
        }

        if ($invoice->customer_viewed_at === null) {
            $invoice->customer_viewed_at = now();
            $invoice->save();
            $this->activityLogWriter->record(
                $tenant,
                null,
                'invoice.customer_viewed',
                $invoice,
                array_merge(ActivityLogProperties::invoice($invoice), ['source' => 'customer_email_link']),
                null
            );
        }

        return view('public.customer-document-viewed', [
            'title' => 'Invoice',
            'heading' => 'Thank you',
            'line' => 'We have recorded that you opened invoice '.($invoice->invoice_ref ?? '#'.$invoice->id).'. You may close this window.',
        ]);
    }

    private function quotationViewed(Tenant $tenant, int $id): View
    {
        $quotation = Quotation::query()
            ->where('tenant_id', $tenant->id)
            ->whereKey($id)
            ->firstOrFail();

        if (strcasecmp((string) $quotation->status, 'Sent') !== 0) {
            abort(404);
        }

        if ($quotation->customer_viewed_at === null) {
            $quotation->customer_viewed_at = now();
            $quotation->save();
            $this->activityLogWriter->record(
                $tenant,
                null,
                'quotation.customer_viewed',
                $quotation,
                array_merge(ActivityLogProperties::quotation($quotation), ['source' => 'customer_email_link']),
                null
            );
        }

        return view('public.customer-document-viewed', [
            'title' => 'Quotation',
            'heading' => 'Thank you',
            'line' => 'We have recorded that you opened quotation '.($quotation->quote_ref ?? '#'.$quotation->id).'. You may close this window.',
        ]);
    }

    private function proposalViewed(Tenant $tenant, int $id): View
    {
        $proposal = Proposal::query()
            ->where('tenant_id', $tenant->id)
            ->whereKey($id)
            ->firstOrFail();

        if (strcasecmp((string) $proposal->status, 'Sent') !== 0) {
            abort(404);
        }

        if ($proposal->customer_viewed_at === null) {
            $proposal->customer_viewed_at = now();
            $proposal->save();
            $this->activityLogWriter->record(
                $tenant,
                null,
                'proposal.customer_viewed',
                $proposal,
                array_merge($this->proposalProperties($proposal), ['source' => 'customer_email_link']),
                null
            );
        }

        return view('public.customer-document-viewed', [
            'title' => 'Proposal',
            'heading' => 'Thank you',
            'line' => 'We have recorded that you opened proposal '.($proposal->proposal_ref ?? '#'.$proposal->id).'. You may close this window.',
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function proposalProperties(Proposal $proposal): array
    {
        return [
            'proposal_id' => $proposal->id,
            'proposal_ref' => $proposal->proposal_ref,
            'status' => $proposal->status,
            'total_amount' => (float) $proposal->total_amount,
        ];
    }
}
