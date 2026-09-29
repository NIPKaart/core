<x-mail::message>
# {{ __('contact.topics.'.$topic) }}

**{{ __('contact.mail.from') }}:** {{ $senderName }} ({{ $senderEmail }})

@if ($location)
**{{ __('contact.mail.location') }}:** {{ $location }}
@endif

{{ $body }}

{{ __('contact.mail.reply') }}
</x-mail::message>
