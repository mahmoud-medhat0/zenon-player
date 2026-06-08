<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class SettingsController extends Controller
{
    public function updateProfile(Request $request)
    {
        $user = $request->user();
        
        $request->validate([
            'name' => 'required|string',
            'email' => ['required', 'email', Rule::unique('users')->ignore($user->id)],
        ]);

        $user->update([
            'name' => $request->name,
            'email' => $request->email,
        ]);

        return response()->json(['message' => 'Profile updated successfully', 'user' => $user->load('tenant')]);
    }

    public function updatePassword(Request $request)
    {
        $user = $request->user();
        
        $request->validate([
            'current_password' => 'required',
            'new_password' => 'required|min:8',
        ]);

        if (!Hash::check($request->current_password, $user->password)) {
            return response()->json(['message' => 'Current password is incorrect'], 422);
        }

        $user->update([
            'password' => Hash::make($request->new_password)
        ]);

        return response()->json(['message' => 'Password updated successfully']);
    }
    
    public function updateTenant(Request $request)
    {
        $tenant = $request->user()->tenant;
        
        $rules = [
            'name' => 'required|string',
            'allowed_domains' => 'sometimes|array',
            'allowed_domains.*' => 'string|url',
        ];

        if ($tenant->hasFeature('custom_branding')) {
            $rules['primary_color'] = 'sometimes|string';
            $rules['logo_url'] = 'sometimes|nullable|url';
        }

        $validated = $request->validate($rules);

        $updateData = ['name' => $request->name];

        if ($request->has('allowed_domains')) {
            // Ensure no trailing slashes for consistency in CORS
            $updateData['allowed_domains'] = array_map(function ($domain) {
                return rtrim($domain, '/');
            }, $request->allowed_domains);
        }

        if ($tenant->hasFeature('custom_branding')) {
            if ($request->has('primary_color')) {
                $updateData['primary_color'] = $request->primary_color;
            }
            if ($request->has('logo_url')) {
                $updateData['logo_url'] = $request->logo_url;
            }
        }

        $tenant->update($updateData);

        return response()->json(['message' => 'Workspace updated successfully', 'tenant' => $tenant]);
    }
}
