<?php

return [

    /*
    |--------------------------------------------------------------------------
    | SPA base URL (TillFlow React app)
    |--------------------------------------------------------------------------
    |
    | Used for password reset and user invite links sent by email. No trailing
    | slash. Example: http://localhost:5173 or https://pos.example.com
    |
    */

    'frontend_url' => rtrim((string) env('TILLFLOW_FRONTEND_URL', env('FRONTEND_URL', 'http://localhost:5173')), '/'),

];
