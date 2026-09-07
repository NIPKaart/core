<?php

namespace App\Actions\Passkeys;

use InvalidArgumentException;
use Laravel\Passkeys\Exceptions\InvalidPasskeyException;
use Webauthn\AuthenticatorAttestationResponse;
use Webauthn\CredentialRecord;
use Webauthn\Exception\WebauthnException;
use Webauthn\PublicKeyCredentialCreationOptions;

class StorePasskey extends \Laravel\Passkeys\Actions\StorePasskey
{
    protected function validate(AuthenticatorAttestationResponse $response, PublicKeyCredentialCreationOptions $options): CredentialRecord
    {
        try {
            return parent::validate($response, $options);
        } catch (WebauthnException|InvalidArgumentException) {
            throw InvalidPasskeyException::make('Unable to register this passkey. Please try again.');
        }
    }
}
