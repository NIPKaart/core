<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * A message from the public contact form. It is only delivered by mail and never stored in the database.
 */
class ContactMessage extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    /** The public address that receives contact form messages and is shown on the contact page. */
    public const string RECIPIENT = 'info@nipkaart.nl';

    public function __construct(
        public string $topic,
        public string $senderName,
        public string $senderEmail,
        public ?string $location,
        public string $body,
    ) {
        $this->locale('nl');
    }

    /**
     * Get the message envelope. Replies go straight to the sender.
     */
    public function envelope(): Envelope
    {
        return new Envelope(
            replyTo: [new Address($this->senderEmail, $this->senderName)],
            subject: __('contact.mail.subject', ['topic' => __("contact.topics.{$this->topic}"), 'name' => $this->senderName]),
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        return new Content(markdown: 'mail.contact-message');
    }
}
