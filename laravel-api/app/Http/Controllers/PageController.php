<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;

class PageController extends Controller
{
    public function dashboard()
    {
        return Inertia::render('Dashboard');
    }

    public function embed($videoId)
    {
        return Inertia::render('EmbedPlayer', [
            'videoId' => $videoId,
        ]);
    }

    public function admin()
    {
        $this->authorizeAdmin();

        return Inertia::render('admin/Dashboard');
    }

    public function adminUsers()
    {
        $this->authorizeAdmin();

        return Inertia::render('admin/Users');
    }

    public function adminTenants()
    {
        $this->authorizeAdmin();

        return Inertia::render('admin/Tenants');
    }

    public function adminPlans()
    {
        $this->authorizeAdmin();

        return Inertia::render('admin/Plans');
    }

    public function login()
    {
        return Inertia::render('auth/Login');
    }

    private function authorizeAdmin()
    {
        $user = auth()->user();
        if (!$user || !in_array($user->role, ['admin', 'super_admin'])) {
            abort(403, 'Unauthorized.');
        }
    }
}
