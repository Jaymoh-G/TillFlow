<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Proposal;
use App\Models\Tenant;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProposalReportController extends Controller
{
    /**
     * Recent proposals for the admin dashboard (same date presets as other dashboard widgets).
     */
    public function dashboardRecentProposals(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');
        $limit = min(50, max(1, (int) $request->query('limit', 10)));
        $range = $this->resolveProposalDateRangeForDashboard($request);

        $query = Proposal::query()
            ->where('tenant_id', $tenant->id)
            ->with(['customer:id,avatar_url']);

        if ($range !== null) {
            [$from, $to] = $range;
            $query->whereDate('proposed_at', '>=', $from)->whereDate('proposed_at', '<=', $to);
        }

        $proposals = $query
            ->orderByDesc('proposed_at')
            ->orderByDesc('id')
            ->limit($limit)
            ->get();

        $out = [];
        foreach ($proposals as $p) {
            $avatar = $p->recipient_image_url ?? $p->customer?->avatar_url;
            $out[] = [
                'id' => $p->id,
                'date' => $p->proposed_at?->format('j M Y'),
                'customer_name' => $p->recipient_name,
                'reference' => $p->proposal_ref,
                'avatar_url' => $avatar,
                'status_label' => $p->status,
                'badge_variant' => $this->proposalStatusBadgeVariant($p->status),
                'total' => $p->total_amount !== null ? (string) number_format((float) $p->total_amount, 2, '.', '') : '0',
                'currency' => 'KES',
            ];
        }

        return response()->json([
            'message' => 'Recent proposals.',
            'proposals' => $out,
        ]);
    }

    /**
     * @return array{0: string, 1: string}|null null = no date filter (all time)
     */
    private function resolveProposalDateRangeForDashboard(Request $request): ?array
    {
        $from = $request->query('from');
        $to = $request->query('to');
        if (is_string($from) && $from !== '' && is_string($to) && $to !== '') {
            return [$from, $to];
        }

        $period = $request->query('period', 'week');
        $now = Carbon::now();

        return match ($period) {
            'today' => [$now->toDateString(), $now->toDateString()],
            'week' => [$now->copy()->startOfWeek()->toDateString(), $now->copy()->endOfWeek()->toDateString()],
            'month' => [$now->copy()->startOfMonth()->toDateString(), $now->copy()->endOfMonth()->toDateString()],
            '6months' => [$now->copy()->subMonths(6)->startOfDay()->toDateString(), $now->copy()->toDateString()],
            '1year' => [$now->copy()->subYear()->startOfDay()->toDateString(), $now->copy()->toDateString()],
            'all' => null,
            default => [$now->copy()->startOfWeek()->toDateString(), $now->copy()->endOfWeek()->toDateString()],
        };
    }

    private function proposalStatusBadgeVariant(string $status): string
    {
        return match ($status) {
            'Accepted' => 'success',
            'Sent' => 'info',
            'Draft' => 'secondary',
            'Expired' => 'warning',
            'Declined' => 'danger',
            default => 'secondary',
        };
    }

    /**
     * Proposal register for reporting: filter by proposed date (or all dates).
     */
    public function index(Request $request): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = $request->attributes->get('tenant');

        $allDates = $request->boolean('all_dates');
        $from = $request->query('from');
        $to = $request->query('to');

        $query = Proposal::query()
            ->where('tenant_id', $tenant->id)
            ->with([
                'lead:id,code,name',
            ]);

        if (! $allDates && is_string($from) && $from !== '' && is_string($to) && $to !== '') {
            $query->whereDate('proposed_at', '>=', $from)->whereDate('proposed_at', '<=', $to);
        }

        $proposals = $query
            ->orderByDesc('proposed_at')
            ->orderByDesc('id')
            ->get();

        $rows = [];
        $sum = 0.0;
        $accepted = 0;
        $sent = 0;
        $acceptedAmount = 0.0;
        $draft = 0;
        $declined = 0;
        $expired = 0;

        foreach ($proposals as $p) {
            $amt = $p->total_amount !== null ? (float) $p->total_amount : 0.0;
            $sum += $amt;
            if ($p->status === 'Sent') {
                $sent++;
            }
            if ($p->status === 'Draft') {
                $draft++;
            }
            if ($p->status === 'Declined') {
                $declined++;
            }
            if ($p->status === 'Expired') {
                $expired++;
            }
            if ($p->status === 'Accepted') {
                $accepted++;
                $acceptedAmount += $amt;
            }
            $rows[] = [
                'id' => $p->id,
                'proposal_ref' => $p->proposal_ref,
                'proposal_title' => $p->proposal_title,
                'status' => $p->status,
                'proposed_at' => $p->proposed_at?->format('Y-m-d'),
                'expires_at' => $p->expires_at?->format('Y-m-d'),
                'recipient_name' => $p->recipient_name,
                'lead_code' => $p->lead?->code,
                'biller_name' => $p->biller_name,
                'total_amount' => $p->total_amount !== null ? round((float) $p->total_amount, 2) : null,
            ];
        }

        return response()->json([
            'message' => 'Proposal report.',
            'rows' => $rows,
            'summary' => [
                'count' => count($rows),
                'total_amount' => round($sum, 2),
                'sent_count' => $sent,
                'accepted_count' => $accepted,
                'accepted_total_amount' => round($acceptedAmount, 2),
                'draft_count' => $draft,
                'declined_count' => $declined,
                'expired_count' => $expired,
            ],
        ]);
    }
}
