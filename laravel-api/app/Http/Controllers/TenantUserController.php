<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class TenantUserController extends Controller
{
    public function __construct()
    {
        // Add middleware check directly if we wanted, or just do it in methods
    }

    public function index(Request $request)
    {
        if ($request->user()->role !== 'owner') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        $users = $request->user()->tenant->users()->select('id', 'name', 'email', 'role', 'created_at')->get();
        return response()->json(['users' => $users]);
    }

    public function store(Request $request)
    {
        if ($request->user()->role !== 'owner') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $tenant = $request->user()->tenant;
        
        if ($tenant->getCurrentUserCount() >= $tenant->getMaxUsers()) {
            return response()->json(['message' => 'Maximum user limit reached for your plan.'], 403);
        }

        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:8',
        ]);

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'tenant_id' => $tenant->id,
            'role' => 'user',
        ]);

        return response()->json(['message' => 'Team member added successfully', 'user' => $user], 201);
    }

    public function destroy(Request $request, $id)
    {
        if ($request->user()->role !== 'owner') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $tenant = $request->user()->tenant;
        $userToDelete = $tenant->users()->findOrFail($id);

        if ($userToDelete->role === 'owner') {
            return response()->json(['message' => 'Cannot delete the workspace owner.'], 403);
        }

        $userToDelete->delete();

        return response()->json(['message' => 'Team member removed successfully']);
    }
}
