<?php

namespace App\Security;

use App\Entity\ApiToken;
use App\Entity\User;
use Symfony\Component\Security\Core\Authentication\Token\PreAuthenticatedToken;

class ApiKeyAuthenticatedToken extends PreAuthenticatedToken
{
    private $token;

    /**
     * @param ApiToken $apiToken
     * @param User     $user
     * @param string   $credentials
     * @param string   $providerKey
     * @param array    $roles
     */
    public function __construct(ApiToken $apiToken, User $user, string $credentials, string $providerKey, array $roles = [])
    {
        parent::__construct($user, $credentials, $providerKey, $roles);

        $this->token = $apiToken;
    }

    /**
     * @return ApiToken
     */
    public function getApiToken()
    {
        return $this->token;
    }
}
