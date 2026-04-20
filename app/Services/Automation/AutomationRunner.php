<?php

namespace App\Services\Automation;

use App\Models\Invoice;
use App\Models\Proposal;
use App\Models\Quotation;
use App\Models\Tenant;
use App\Services\ActivityLogWriter;
use App\Services\Sms\TenantSmsSender;
use App\Support\TenantAutomationSettings;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class AutomationRunner
{
    public function __construct(
        private readonly TenantSmsSender $sms,
        private readonly ActivityLogWriter $activityLog,
    ) {}

    public function runForTenant(Tenant $tenant): void
    {
        $settings = TenantAutomationSettings::forTenant($tenant);
        $tz = $settings['timezone'];
        $now = Carbon::now($tz);
        $hour = (int) $settings['runHourLocal'];
        if ((int) $now->format('G') !== $hour) {
            return;
        }

        $lockKey = 'automation-run:'.$tenant->id.':'.$now->format('Y-m-d-H');
        if (! Cache::add($lockKey, 1, now()->addMinutes(120))) {
            return;
        }

        $today = $now->copy()->startOfDay();

        $this->processInvoices($tenant, $settings, $today);
        $this->processQuotations($tenant, $settings, $today);
        $this->processProposals($tenant, $settings, $today);
    }

    /**
     * @param  array<string, mixed>  $settings
     */
    private function processInvoices(Tenant $tenant, array $settings, Carbon $today): void
    {
        $invoices = Invoice::query()
            ->where('tenant_id', $tenant->id)
            ->whereNotIn('status', [Invoice::STATUS_DRAFT, Invoice::STATUS_CANCELLED, Invoice::STATUS_PAID])
            ->whereNotNull('due_at')
            ->with(['customer:id,email,phone'])
            ->get();

        foreach ($invoices as $invoice) {
            if (! $this->invoiceIsOpen($invoice)) {
                continue;
            }

            $due = Carbon::parse($invoice->due_at)->timezone($settings['timezone'])->startOfDay();

            $this->maybeDueReminder($tenant, $invoice, $settings, $today, $due);
            $this->maybeOverdueNotices($tenant, $invoice, $settings, $today, $due);
        }
    }

    private function invoiceIsOpen(Invoice $invoice): bool
    {
        $total = round((float) $invoice->total_amount, 2);
        $paid = round((float) $invoice->amount_paid, 2);

        return $paid + 0.009 < $total;
    }

    /**
     * @param  array<string, mixed>  $settings
     */
    private function maybeDueReminder(Tenant $tenant, Invoice $invoice, array $settings, Carbon $today, Carbon $due): void
    {
        $daysBefore = (int) $settings['dueReminderDaysBefore'];
        if ($daysBefore < 0) {
            return;
        }
        $target = $due->copy()->subDays($daysBefore);
        if (! $today->isSameDay($target)) {
            return;
        }

        $ch = $settings['invoiceDueReminderChannels'];
        if (! empty($ch['email']) && ! $invoice->due_reminder_email_sent_at) {
            $to = trim((string) ($invoice->customer?->email ?? ''));
            if ($to !== '') {
                $subject = 'Payment reminder: invoice '.$invoice->invoice_ref;
                $body = "Hello {$invoice->customer_name},\n\nThis is a reminder that invoice {$invoice->invoice_ref} (".number_format((float) $invoice->total_amount, 2).') is due on '.$due->toDateString().".\n\nThank you.";
                try {
                    Mail::raw($body, function ($m) use ($to, $subject): void {
                        $m->to($to)->subject($subject);
                    });
                    $invoice->due_reminder_email_sent_at = now();
                    $invoice->saveQuietly();
                    $this->activityLog->record($tenant, null, 'automation.invoice_due_reminder', $invoice, ['channel' => 'email']);
                } catch (\Throwable $e) {
                    Log::warning('Automation due reminder email failed', ['invoice_id' => $invoice->id, 'e' => $e->getMessage()]);
                }
            }
        }

        if (! empty($ch['sms']) && ! $invoice->due_reminder_sms_sent_at) {
            $phone = trim((string) ($invoice->customer?->phone ?? ''));
            if ($phone !== '') {
                $msg = "Reminder: {$invoice->invoice_ref} due ".$due->toDateString().'. Bal '.number_format((float) $invoice->total_amount, 2).'.';
                try {
                    $this->sms->send($tenant, $phone, $msg);
                    $invoice->due_reminder_sms_sent_at = now();
                    $invoice->saveQuietly();
                    $this->activityLog->record($tenant, null, 'automation.invoice_due_reminder', $invoice, ['channel' => 'sms']);
                } catch (\Throwable $e) {
                    Log::warning('Automation due reminder SMS failed', ['invoice_id' => $invoice->id, 'e' => $e->getMessage()]);
                }
            }
        }
    }

    /**
     * @param  array<string, mixed>  $settings
     */
    private function maybeOverdueNotices(Tenant $tenant, Invoice $invoice, array $settings, Carbon $today, Carbon $due): void
    {
        if ($today->lte($due)) {
            return;
        }

        $ch = $settings['invoiceOverdueChannels'];
        $n = (int) $settings['overdueFirstNoticeDaysAfterDue'];
        $firstEligible = $due->copy()->addDays($n);
        if ($today->lt($firstEligible)) {
            return;
        }

        $resendEvery = (int) $settings['overdueResendEveryDays'];

        if (! empty($ch['email'])) {
            $to = trim((string) ($invoice->customer?->email ?? ''));
            if ($to !== '') {
                if ($invoice->overdue_notice_email_sent_at === null) {
                    $this->sendOverdueEmail($invoice, $to, $due, false);
                    $invoice->overdue_notice_email_sent_at = now();
                    $invoice->overdue_last_resent_email_at = now();
                    $invoice->saveQuietly();
                    $this->activityLog->record($tenant, null, 'automation.invoice_overdue', $invoice, ['channel' => 'email', 'first' => true]);
                } elseif ($resendEvery > 0 && $invoice->overdue_last_resent_email_at) {
                    $next = Carbon::parse($invoice->overdue_last_resent_email_at)->addDays($resendEvery)->startOfDay();
                    if ($today->gte($next)) {
                        $this->sendOverdueEmail($invoice, $to, $due, true);
                        $invoice->overdue_last_resent_email_at = now();
                        $invoice->saveQuietly();
                        $this->activityLog->record($tenant, null, 'automation.invoice_overdue', $invoice, ['channel' => 'email', 'first' => false]);
                    }
                }
            }
        }

        $invoice->refresh();

        if (! empty($ch['sms'])) {
            $phone = trim((string) ($invoice->customer?->phone ?? ''));
            if ($phone === '') {
                return;
            }

            if ($invoice->overdue_notice_sms_sent_at === null) {
                $msg = "Overdue: {$invoice->invoice_ref}. Due ".$due->toDateString().'. Bal '.number_format((float) $invoice->total_amount, 2).'.';
                try {
                    $this->sms->send($tenant, $phone, $msg);
                    $invoice->overdue_notice_sms_sent_at = now();
                    $invoice->overdue_last_resent_sms_at = now();
                    $invoice->saveQuietly();
                    $this->activityLog->record($tenant, null, 'automation.invoice_overdue', $invoice, ['channel' => 'sms', 'first' => true]);
                } catch (\Throwable $e) {
                    Log::warning('Automation overdue SMS failed', ['invoice_id' => $invoice->id, 'e' => $e->getMessage()]);
                }
            } elseif ($resendEvery > 0 && $invoice->overdue_last_resent_sms_at) {
                $next = Carbon::parse($invoice->overdue_last_resent_sms_at)->addDays($resendEvery)->startOfDay();
                if ($today->gte($next)) {
                    $msg = "Reminder overdue: {$invoice->invoice_ref}. Bal ".number_format((float) $invoice->total_amount, 2).'.';
                    try {
                        $this->sms->send($tenant, $phone, $msg);
                        $invoice->overdue_last_resent_sms_at = now();
                        $invoice->saveQuietly();
                        $this->activityLog->record($tenant, null, 'automation.invoice_overdue', $invoice, ['channel' => 'sms', 'first' => false]);
                    } catch (\Throwable $e) {
                        Log::warning('Automation overdue SMS resend failed', ['invoice_id' => $invoice->id, 'e' => $e->getMessage()]);
                    }
                }
            }
        }
    }

    private function sendOverdueEmail(Invoice $invoice, string $to, Carbon $due, bool $isResend): void
    {
        $subject = ($isResend ? 'Overdue reminder: ' : 'Overdue: ').'invoice '.$invoice->invoice_ref;
        $body = "Hello {$invoice->customer_name},\n\nInvoice {$invoice->invoice_ref} was due on ".$due->toDateString().' and remains unpaid. Amount: '.number_format((float) $invoice->total_amount, 2).".\n\nThank you.";
        try {
            Mail::raw($body, function ($m) use ($to, $subject): void {
                $m->to($to)->subject($subject);
            });
        } catch (\Throwable $e) {
            Log::warning('Automation overdue email failed', ['invoice_id' => $invoice->id, 'e' => $e->getMessage()]);
        }
    }

    /**
     * @param  array<string, mixed>  $settings
     */
    private function processQuotations(Tenant $tenant, array $settings, Carbon $today): void
    {
        $days = (int) $settings['quoteExpiryReminderDaysBefore'];
        if ($days < 0) {
            return;
        }

        $quotations = Quotation::query()
            ->where('tenant_id', $tenant->id)
            ->whereIn('status', ['Draft', 'Sent'])
            ->whereNotNull('expires_at')
            ->with(['customer:id,email,phone'])
            ->get();

        foreach ($quotations as $q) {
            $exp = Carbon::parse($q->expires_at)->timezone($settings['timezone'])->startOfDay();
            $target = $exp->copy()->subDays($days);
            if (! $today->isSameDay($target)) {
                continue;
            }

            $ch = $settings['quoteExpiryReminderChannels'];
            if (! empty($ch['email']) && ! $q->expiry_reminder_email_sent_at) {
                $to = trim((string) ($q->customer?->email ?? ''));
                if ($to !== '') {
                    try {
                        Mail::raw(
                            "Hello {$q->customer_name},\n\nQuotation {$q->quote_ref} expires on ".$exp->toDateString().'. Total: '.number_format((float) $q->total_amount, 2).".\n",
                            function ($m) use ($to, $q): void {
                                $m->to($to)->subject('Quotation expiring: '.$q->quote_ref);
                            }
                        );
                        $q->expiry_reminder_email_sent_at = now();
                        $q->saveQuietly();
                        $this->activityLog->record($tenant, null, 'automation.quotation_expiry_reminder', $q, ['channel' => 'email']);
                    } catch (\Throwable $e) {
                        Log::warning('Quotation expiry email failed', ['id' => $q->id, 'e' => $e->getMessage()]);
                    }
                }
            }

            if (! empty($ch['sms']) && ! $q->expiry_reminder_sms_sent_at) {
                $phone = trim((string) ($q->customer?->phone ?? ''));
                if ($phone !== '') {
                    try {
                        $this->sms->send($tenant, $phone, "{$q->quote_ref} expires ".$exp->toDateString().'.');
                        $q->expiry_reminder_sms_sent_at = now();
                        $q->saveQuietly();
                        $this->activityLog->record($tenant, null, 'automation.quotation_expiry_reminder', $q, ['channel' => 'sms']);
                    } catch (\Throwable $e) {
                        Log::warning('Quotation expiry SMS failed', ['id' => $q->id, 'e' => $e->getMessage()]);
                    }
                }
            }
        }
    }

    /**
     * @param  array<string, mixed>  $settings
     */
    private function processProposals(Tenant $tenant, array $settings, Carbon $today): void
    {
        $days = (int) $settings['proposalExpiryReminderDaysBefore'];
        if ($days < 0) {
            return;
        }

        $proposals = Proposal::query()
            ->where('tenant_id', $tenant->id)
            ->whereIn('status', ['Draft', 'Sent'])
            ->whereNotNull('expires_at')
            ->with(['customer', 'lead'])
            ->get();

        foreach ($proposals as $p) {
            $exp = Carbon::parse($p->expires_at)->timezone($settings['timezone'])->startOfDay();
            $target = $exp->copy()->subDays($days);
            if (! $today->isSameDay($target)) {
                continue;
            }

            $ch = $settings['proposalExpiryReminderChannels'];
            if (! empty($ch['email']) && ! $p->expiry_reminder_email_sent_at) {
                $to = '';
                if ($p->customer_id && $p->customer) {
                    $to = trim((string) ($p->customer->email ?? ''));
                } elseif ($p->lead_id && $p->lead) {
                    $to = trim((string) ($p->lead->email ?? ''));
                }
                if ($to !== '') {
                    try {
                        Mail::raw(
                            "Hello {$p->recipient_name},\n\nProposal {$p->proposal_ref} expires on ".$exp->toDateString().'. Total: '.number_format((float) $p->total_amount, 2).".\n",
                            function ($m) use ($to, $p): void {
                                $m->to($to)->subject('Proposal expiring: '.$p->proposal_ref);
                            }
                        );
                        $p->expiry_reminder_email_sent_at = now();
                        $p->saveQuietly();
                        $this->activityLog->record($tenant, null, 'automation.proposal_expiry_reminder', $p, ['channel' => 'email']);
                    } catch (\Throwable $e) {
                        Log::warning('Proposal expiry email failed', ['id' => $p->id, 'e' => $e->getMessage()]);
                    }
                }
            }

            if (! empty($ch['sms']) && ! $p->expiry_reminder_sms_sent_at) {
                $phone = '';
                if ($p->customer_id && $p->customer) {
                    $phone = trim((string) ($p->customer->phone ?? ''));
                } elseif ($p->lead_id && $p->lead) {
                    $phone = trim((string) ($p->lead->phone ?? ''));
                }
                if ($phone !== '') {
                    try {
                        $this->sms->send($tenant, $phone, "{$p->proposal_ref} expires ".$exp->toDateString().'.');
                        $p->expiry_reminder_sms_sent_at = now();
                        $p->saveQuietly();
                        $this->activityLog->record($tenant, null, 'automation.proposal_expiry_reminder', $p, ['channel' => 'sms']);
                    } catch (\Throwable $e) {
                        Log::warning('Proposal expiry SMS failed', ['id' => $p->id, 'e' => $e->getMessage()]);
                    }
                }
            }
        }
    }
}
