<?php

use App\Mail\ContactMessage;
use Illuminate\Support\Facades\Mail;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    Mail::fake();
});

function contactMessage(array $overrides = []): array
{
    return [
        'topic' => 'map_error', 'name' => 'Sam de Vries', 'email' => 'sam@example.com',
        'location' => 'Jan Luijkenstraat, Amsterdam', 'message' => 'Het bord staat nu aan de overkant.', ...$overrides,
    ];
}

it('shows the public address on the contact page', function () {
    $this->get(route('contact'))->assertInertia(fn (Assert $page) => $page->where('email', ContactMessage::RECIPIENT));
});

it('mails a message to NIPKaart with the sender as reply address', function () {
    $this->from(route('contact'))->post(route('contact.store'), contactMessage())->assertRedirect(route('contact'));

    Mail::assertQueued(ContactMessage::class, function (ContactMessage $mail): bool {
        return $mail->hasTo(ContactMessage::RECIPIENT)
            && $mail->hasReplyTo('sam@example.com', 'Sam de Vries')
            && $mail->location === 'Jan Luijkenstraat, Amsterdam'
            && $mail->body === 'Het bord staat nu aan de overkant.';
    });
});

it('only keeps the place for a map error', function () {
    $this->post(route('contact.store'), contactMessage(['topic' => 'question']));

    Mail::assertQueued(ContactMessage::class, fn (ContactMessage $mail): bool => $mail->topic === 'question' && $mail->location === null);
});

it('rejects incomplete messages without sending anything', function (array $overrides, string $field) {
    $this->post(route('contact.store'), contactMessage($overrides))->assertSessionHasErrors($field);

    Mail::assertNothingQueued();
})->with([
    'unknown topic' => [['topic' => 'marketing'], 'topic'],
    'missing name' => [['name' => ''], 'name'],
    'invalid e-mail' => [['email' => 'sam'], 'email'],
    'empty message' => [['message' => ''], 'message'],
]);

it('answers a filled honeypot like a real message but sends nothing', function () {
    $this->from(route('contact'))->post(route('contact.store'), contactMessage(['website' => 'https://spam.example']))->assertRedirect(route('contact'));

    Mail::assertNothingQueued();
});

it('limits how often the form can be sent', function () {
    foreach (range(1, 5) as $attempt) {
        $this->post(route('contact.store'), contactMessage())->assertRedirect();
    }

    $this->post(route('contact.store'), contactMessage())->assertTooManyRequests();
});

it('renders the message for the NIPKaart inbox in Dutch', function () {
    $mail = new ContactMessage('map_error', 'Sam de Vries', 'sam@example.com', 'Jan Luijkenstraat, Amsterdam', 'Het bord staat nu aan de overkant.');

    $mail->assertHasSubject('Contactformulier: Fout op de kaart van Sam de Vries');
    $mail->assertSeeInHtml('Jan Luijkenstraat, Amsterdam');
    $mail->assertSeeInHtml('Het bord staat nu aan de overkant.');
});
