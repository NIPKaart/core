<?php

namespace App\Http\Controllers\Frontend;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreContactMessageRequest;
use App\Mail\ContactMessage;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Inertia\Inertia;
use Inertia\Response;

class ContactController extends Controller
{
    /**
     * Frontend - Render the contact page, optionally with a topic chosen by the page that links here.
     */
    public function index(Request $request): Response
    {
        $topic = $request->query('topic');

        return Inertia::render('frontend/contact', [
            'email' => ContactMessage::RECIPIENT,
            'topic' => in_array($topic, StoreContactMessageRequest::TOPICS, true) ? $topic : null,
        ]);
    }

    /**
     * Frontend - Send a contact form message by mail. A filled honeypot gets the same answer, so bots learn nothing.
     */
    public function store(StoreContactMessageRequest $request): RedirectResponse
    {
        if (! $request->isSpam()) {
            Mail::to(ContactMessage::RECIPIENT)->queue(new ContactMessage(
                topic: $request->validated('topic'),
                senderName: $request->validated('name'),
                senderEmail: $request->validated('email'),
                location: $request->validated('topic') === 'map_error' ? $request->validated('location') : null,
                body: $request->validated('message'),
            ));
        }

        Inertia::flash('success', __('contact.sent'));

        return back();
    }
}
