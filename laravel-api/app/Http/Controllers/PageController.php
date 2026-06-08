<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;

class PageController extends Controller
{
    private const DASHBOARD_PAGES = [
        'library' => 'Library',
        'analytics' => 'Analytics',
        'settings' => 'Settings',
        'team' => 'Team',
    ];

    public function dashboard()
    {
        return $this->dashboardPage('library');
    }

    public function library()
    {
        return $this->dashboardPage('library');
    }

    public function analytics()
    {
        return $this->dashboardPage('analytics');
    }

    public function settings()
    {
        return $this->dashboardPage('settings');
    }

    public function team()
    {
        return $this->dashboardPage('team');
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

    private function dashboardPage(string $activeTab)
    {
        return Inertia::render(self::DASHBOARD_PAGES[$activeTab], [
            'activeTab' => $activeTab,
        ]);
    }

    private function authorizeAdmin()
    {
        $user = auth()->user();
        if (!$user || !in_array($user->role, ['admin', 'super_admin'])) {
            abort(403, 'Unauthorized.');
        }
    }
}
