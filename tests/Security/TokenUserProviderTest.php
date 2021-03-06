<?php

namespace App\Tests\Security;

use App\Entity\User;
use App\Security\TokenUserProvider;
use App\Tests\DB\DbTestCase;
use App\Tests\DB\Fixtures\ValidToken;

class TokenUserProviderTest extends DbTestCase
{
    /** @var TokenUserProvider */
    private $tokenUserProvider;

    protected function setUp()
    {
        $doctrine = static::createClient()->getContainer()->get('doctrine');
        $this->tokenUserProvider = new TokenUserProvider($doctrine);

        $this->initialize([
            'App\Tests\DB\Fixtures\ValidToken'
        ]);
    }

    public function testGetUserForToken()
    {
        $user = $this->tokenUserProvider->getUserForToken(ValidToken::TOKEN);
        self::assertNotNull($user);
        self::assertTrue($user instanceof User);
    }

    /**
     * @expectedException \Symfony\Component\Security\Core\Exception\UsernameNotFoundException
     */
    public function testLoadInvalidUserByUsername()
    {
        $this->tokenUserProvider->loadUserByUsername('invalid_user_name');
    }

    public function testLoadValidUserByUsername()
    {
        $user = $this->tokenUserProvider->loadUserByUsername('foo');
        self::assertNotNull($user);
        self::assertTrue($user instanceof User);
    }

    /**
     * @expectedException \Symfony\Component\Security\Core\Exception\UnsupportedUserException
     */
    public function testRefreshUser()
    {
        $user = new User();
        $this->tokenUserProvider->refreshUser($user);
    }

    public function testSupportsClass()
    {
        self::assertTrue($this->tokenUserProvider->supportsClass(User::class));
    }
}
