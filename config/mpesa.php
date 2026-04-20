<?php

return [
    'environment' => env('MPESA_ENV', 'sandbox'),

    'base_urls' => [
        'sandbox' => 'https://sandbox.safaricom.co.ke',
        'production' => 'https://api.safaricom.co.ke',
    ],

    'consumer_key' => env('MPESA_CONSUMER_KEY', ''),
    'consumer_secret' => env('MPESA_CONSUMER_SECRET', ''),

    'shortcode' => env('MPESA_SHORTCODE', ''),
    'passkey' => env('MPESA_PASSKEY', ''),

    'stk_callback_path' => env('MPESA_STK_CALLBACK_PATH', '/api/v1/webhooks/mpesa/stk-callback'),

    'transaction_type' => env('MPESA_TRANSACTION_TYPE', 'CustomerPayBillOnline'),
];
