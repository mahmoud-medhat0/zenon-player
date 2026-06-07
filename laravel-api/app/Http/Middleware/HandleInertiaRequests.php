<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    protected $rootView = 'app';

    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'auth' => [
                'user' => $request->user() ? [
                    'id' => $request->user()->id,
                    'name' => $request->user()->name,
                    'email' => $request->user()->email,
                    'role' => $request->user()->role,
                    'is_active' => $request->user()->is_active,
                    'tenant' => $request->user()->tenant ? [
                        'id' => $request->user()->tenant->id,
                        'name' => $request->user()->tenant->name,
                        'plan_tier' => $request->user()->tenant->plan_tier,
                        'is_active' => $request->user()->tenant->is_active,
                        'primary_color' => $request->user()->tenant->primary_color,
                        'logo_url' => $request->user()->tenant->logo_url,
                        'plan' => $request->user()->tenant->plan ? [
                            'id' => $request->user()->tenant->plan->id,
                            'name' => $request->user()->tenant->plan->name,
                            'slug' => $request->user()->tenant->plan->slug,
                            'max_users' => $request->user()->tenant->plan->max_users,
                            'max_storage_gb' => $request->user()->tenant->plan->max_storage_gb,
                            'features' => $request->user()->tenant->plan->features,
                            'is_active' => $request->user()->tenant->plan->is_active,
                        ] : null,
                    ] : null,
                ] : null,
            ],
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
            ],
        ];
    }
}
