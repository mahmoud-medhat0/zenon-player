<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

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
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'expires_at' => 'nullable|date|after:now',
        ]);

        // Define abilities if needed, currently granting all.
        $expiresAt = isset($validated['expires_at'])
            ? Carbon::parse($validated['expires_at'])
            : null;

        $token = $request->user()->createToken(
            $validated['name'],
            ['*'],
            $expiresAt,
        );

        return response()->json([
            'message' => 'Token created successfully.',
            'token' => $token->plainTextToken,
            'expires_at' => $token->accessToken->expires_at,
        ], 201);
    }

    public function destroy(Request $request, $id)
    {
        $request->user()->tokens()->where('id', $id)->delete();

        return response()->json(['message' => 'Token deleted successfully.']);
    }
}
