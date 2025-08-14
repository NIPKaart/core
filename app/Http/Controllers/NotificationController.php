<?php

namespace App\Http\Controllers;

use App\Enums\NotificationType;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class NotificationController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $readCsv = $request->input('read');
        $typeCsv = $request->input('type');
        $types = $typeCsv ? array_filter(explode(',', $typeCsv)) : [];

        $query = $user->notifications()->latest();

        $query->when($readCsv, function ($q, $readCsv) {
            $vals = collect(explode(',', $readCsv));
            $hasRead = $vals->contains('read');
            $hasUnread = $vals->contains('unread');

            if ($hasRead && ! $hasUnread) {
                $q->whereNotNull('read_at');
            } elseif ($hasUnread && ! $hasRead) {
                $q->whereNull('read_at');
            }
        });

        $query->when(! empty($types), fn ($q) => $q->whereIn(
            DB::raw("JSON_UNQUOTE(JSON_EXTRACT(data, '$.type'))"),
            $types
        )
        );

        $notifications = $query
            ->paginate(20)
            ->withQueryString()
            ->through(fn ($n) => [
                'id' => $n->id,
                'type' => data_get($n->data, 'type'),
                'data' => $n->data,
                'read_at' => $n->read_at,
                'created_at' => optional($n->created_at)->toIso8601String(),
            ]);

        return Inertia::render('backend/notifications/index', [
            'notificationList' => $notifications,
            'filters' => [
                'read' => $readCsv,
                'type' => $typeCsv,
            ],
            'options' => [
                'types' => NotificationType::options(),
            ],
        ]);
    }

    public function bulk(Request $request)
    {
        $data = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['string'],
            'action' => ['required', 'in:mark_read,mark_unread,delete'],
        ]);

        $query = $request->user()
            ->notifications()
            ->whereIn('id', $data['ids']);

        switch ($data['action']) {
            case 'mark_read':
                $query->whereNull('read_at')->update(['read_at' => now()]);
                break;

            case 'mark_unread':
                $query->whereNotNull('read_at')->update(['read_at' => null]);
                break;

            case 'delete':
                $query->delete();
                break;
        }

        return back()->with('success', __('Updated notifications'));
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
