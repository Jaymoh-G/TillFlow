<?php

namespace App\Mail;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class TillFlowPasswordSetupMail extends Mailable
{
    use Queueable;
    use SerializesModels;

    public function __construct(
        public User $user,
        public Tenant $tenant,
        public string $actionUrl,
        public string $kind,
    ) {}

    public function build(): TillFlowPasswordSetupMail
    {
        $tenantName = trim((string) ($this->tenant->name ?? '')) ?: 'your organization';

        $subject = $this->kind === 'invite'
            ? "You're invited to {$tenantName} on TillFlow"
            : 'Reset your TillFlow password';

        return $this->subject($subject)->view('mail.tillflow-password-setup');
    }
}
