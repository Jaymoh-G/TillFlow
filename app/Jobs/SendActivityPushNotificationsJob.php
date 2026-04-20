<?php

namespace App\Jobs;

use App\Models\PushSubscription;
use App\Models\Tenant;
use App\Support\ActivityLogPushMessageBuilder;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;
use Throwable;

class SendActivityPushNotificationsJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 2;

    /**
     * @param  array<string, mixed>|null  $properties
     */
    public function __construct(
        public int $tenantId,
        public string $action,
        public ?array $properties,
    ) {}

    public function handle(): void
    {
        $public = config('push.vapid.public_key');
        $private = config('push.vapid.private_key');
        if (! is_string($public) || $public === '' || ! is_string($private) || $private === '') {
            return;
        }

        $tenant = Tenant::query()->find($this->tenantId);
        if ($tenant === null) {
            return;
        }

        $subs = PushSubscription::query()
            ->where('tenant_id', $tenant->id)
            ->get();

        if ($subs->isEmpty()) {
            return;
        }

        $topic = $this->actionToTopic($this->action);
        $payload = ActivityLogPushMessageBuilder::build($this->action, $this->properties);
        $json = json_encode([
            'title' => $payload['title'],
            'body' => $payload['body'],
            'url' => $payload['url'],
        ]);
        if ($json === false) {
            return;
        }

        $auth = [
            'VAPID' => [
                'subject' => config('push.vapid.subject'),
                'publicKey' => $public,
                'privateKey' => $private,
            ],
        ];

        $webPush = new WebPush($auth);

        foreach ($subs as $sub) {
            if (! $this->userWantsPush($tenant, (int) $sub->user_id, $topic)) {
                continue;
            }

            try {
                $subscription = Subscription::create([
                    'endpoint' => $sub->endpoint,
                    'keys' => [
                        'p256dh' => $sub->public_key,
                        'auth' => $sub->auth_secret,
                    ],
                    'contentEncoding' => $sub->content_encoding !== '' ? $sub->content_encoding : 'aes128gcm',
                ]);
                $webPush->queueNotification($subscription, $json);
            } catch (Throwable $e) {
                Log::warning('Push subscription queue failed.', [
                    'subscription_id' => $sub->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        foreach ($webPush->flush() as $report) {
            if ($report->isSubscriptionExpired()) {
                PushSubscription::query()
                    ->where('tenant_id', $tenant->id)
                    ->where('endpoint', $report->getEndpoint())
                    ->delete();
            }
        }
    }

    private function actionToTopic(string $action): string
    {
        if (str_starts_with($action, 'invoice_payment.')) {
            return 'payments';
        }
        if (str_starts_with($action, 'invoice.')) {
            return 'sales';
        }
        if (str_starts_with($action, 'quotation.')) {
            return 'quotations';
        }
        if (str_starts_with($action, 'proposal.')) {
            return 'quotations';
        }
        if (str_starts_with($action, 'customer.')) {
            return 'account';
        }

        return 'sales';
    }

    private function userWantsPush(Tenant $tenant, int $userId, string $topic): bool
    {
        $channelBrowser = true;
        $topicPush = true;

        $ui = $tenant->ui_settings ?? [];
        if (! is_array($ui)) {
            return $channelBrowser && $topicPush;
        }

        $notifications = $ui['notifications'] ?? null;
        if (! is_array($notifications)) {
            return $channelBrowser && $topicPush;
        }

        $slice = $notifications[$userId] ?? $notifications[(string) $userId] ?? null;
        if (! is_array($slice)) {
            return $channelBrowser && $topicPush;
        }

        if (isset($slice['channelBrowser']) && is_bool($slice['channelBrowser'])) {
            $channelBrowser = $slice['channelBrowser'];
        }

        $topics = $slice['topics'] ?? null;
        if (is_array($topics) && isset($topics[$topic]) && is_array($topics[$topic])) {
            $t = $topics[$topic];
            if (isset($t['push']) && is_bool($t['push'])) {
                $topicPush = $t['push'];
            }
        }

        return $channelBrowser && $topicPush;
    }
}
