<?php

namespace App\Actions\Passkeys;

use InvalidArgumentException;
use Laravel\Passkeys\Exceptions\InvalidPasskeyException;
use Laravel\Passkeys\Passkey;
use Webauthn\AuthenticatorAssertionResponse;
use Webauthn\CredentialRecord;
use Webauthn\Exception\WebauthnException;
use Webauthn\PublicKeyCredentialRequestOptions;

class VerifyPasskey extends \Laravel\Passkeys\Actions\VerifyPasskey
{
    protected function validate(AuthenticatorAssertionResponse $response, Passkey $passkey, PublicKeyCredentialRequestOptions $options): CredentialRecord
    {
        try {
            return parent::validate($response, $passkey, $options);
        } catch (WebauthnException|InvalidArgumentException) {
            throw InvalidPasskeyException::make('Unable to verify this passkey. Please try again.');
        }
    }
}
