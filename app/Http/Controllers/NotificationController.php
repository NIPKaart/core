<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Inertia;

class NotificationController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $readCsv = $request->input('read');
        $typeCsv = $request->input('type');

        $types = $typeCsv ? array_values(array_filter(explode(',', $typeCsv))) : [];

        $typesExact = [];
        $cats = [];
        foreach ($types as $t) {
            if (Str::endsWith($t, '.*')) {
                $cats[] = Str::beforeLast($t, '.*');
            } elseif ($t !== '') {
                $typesExact[] = $t;
            }
        }

        $jsonTypeSql = "(data::jsonb ->> 'type')";

        $query = $user->notifications()->latest();

        // read/unread
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

        // type-filter
        $query->when(! empty($typesExact) || ! empty($cats), function ($q) use ($jsonTypeSql, $typesExact, $cats) {
            $q->where(function ($qq) use ($jsonTypeSql, $typesExact, $cats) {
                if (! empty($typesExact)) {
                    $qq->orWhereIn(DB::raw($jsonTypeSql), $typesExact);
                }
                foreach ($cats as $category) {
                    $qq->orWhereRaw("starts_with({$jsonTypeSql}, ?)", [$category.'.']);
                }
            });
        });

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

        $distinct = $user->notifications()
            ->selectRaw("
            DISTINCT
            {$jsonTypeSql} AS t,
            split_part({$jsonTypeSql}, '.', 1) AS cat
        ")
            ->whereRaw("{$jsonTypeSql} IS NOT NULL")
            ->reorder()
            ->get();

        $countPerCat = [];
        $oneTypePerCat = [];
        foreach ($distinct as $row) {
            $cat = $row->cat ?: $row->t;
            $countPerCat[$cat] = ($countPerCat[$cat] ?? 0) + 1;
            $oneTypePerCat[$cat] = $row->t;
        }

        $typeOptions = [];
        foreach ($countPerCat as $cat => $cnt) {
            if ($cnt >= 2) {
                $typeOptions["{$cat}.*"] = "{$cat}.*";
            } else {
                $t = $oneTypePerCat[$cat];
                $typeOptions[$t] = $t;
            }
        }
        ksort($typeOptions, SORT_NATURAL);

        return Inertia::render('backend/notifications/index', [
            'notificationList' => $notifications,
            'filters' => [
                'read' => $readCsv,
                'type' => $typeCsv,
            ],
            'options' => [
                'types' => $typeOptions,
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

        Inertia::flash('success', __('Updated notifications'));

        return back();
    }

    public function readAll(Request $request)
    {
        $request->user()->unreadNotifications->markAsRead();

        Inertia::flash('success', __('Marked all as read'));

        return back();
    }

    public function read(Request $request, string $id)
    {
        $n = $request->user()->notifications()->where('id', $id)->firstOrFail();
        if (is_null($n->read_at)) {
            $n->markAsRead();
        }

        Inertia::flash('success', __('Marked as read'));

        return back();
    }

    public function unread(Request $request, string $id)
    {
        $n = $request->user()->notifications()->where('id', $id)->firstOrFail();
        if (! is_null($n->read_at)) {
            $n->markAsUnread();
        }

        Inertia::flash('success', __('Marked as unread'));

        return back();
    }

    public function remove(Request $request, string $id)
    {
        $request->user()->notifications()->where('id', $id)->delete();

        Inertia::flash('success', __('Deleted'));

        return back();
    }

    public function removeAll(Request $request)
    {
        $request->user()->notifications()->delete();

        Inertia::flash('success', __('Deleted all notifications'));

        return back();
    }
}
