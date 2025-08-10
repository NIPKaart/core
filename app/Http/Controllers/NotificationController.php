<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;

class NotificationController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        return Inertia::render('notifications/index', [
            'notifications' => $user->notifications()
                ->latest()
                ->paginate(20)
                ->through(fn ($n) => [
                    'id' => $n->id,
                    'type' => data_get($n->data, 'type'),
                    'data' => $n->data,
                    'read_at' => $n->read_at,
                    'created_at' => $n->created_at,
                ]),
            'unread_count' => $user->unreadNotifications()->count(),
        ]);
    }

    public function readAll(Request $request)
    {
        $request->user()->unreadNotifications->markAsRead();

        return back()->with('success', __('Marked all as read'));
    }

    public function read(Request $request, string $id)
    {
        $n = $request->user()->notifications()->where('id', $id)->firstOrFail();
        if (is_null($n->read_at)) {
            $n->markAsRead();
        }

        return back()->with('success', __('Marked as read'));
    }

    public function remove(Request $request, string $id)
    {
        $request->user()->notifications()->where('id', $id)->delete();

        return back()->with('success', __('Deleted'));
    }

    public function removeAll(Request $request)
    {
        $request->user()->notifications()->delete();

        return back()->with('success', __('Deleted all notifications'));
    }
}
