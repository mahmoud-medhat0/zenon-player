<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class ApiTokenController extends Controller
{
    public function index(Request $request)
    {
        $tokens = $request->user()->tokens()
            ->where('name', '!=', 'auth_token')
            ->orderBy('created_at', 'desc')
            ->get();
        return response()->json(['tokens' => $tokens]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
        ]);

        // Define abilities if needed, currently granting all.
        $token = $request->user()->createToken($request->name);

        return response()->json([
            'message' => 'Token created successfully.',
            'token' => $token->plainTextToken,
        ]);
    }

    public function destroy(Request $request, $id)
    {
        $request->user()->tokens()->where('id', $id)->delete();

        return response()->json(['message' => 'Token deleted successfully.']);
    }
}
