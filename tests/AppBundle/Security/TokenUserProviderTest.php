<?php
/**
 * Created by PhpStorm.
 * User: fabian
 * Date: 18.10.17
 * Time: 22:18
 */

namespace AppBundle\Security;


use AppBundle\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Registry;
use Symfony\Component\Security\Core\User\UserInterface;
use Tests\AppBundle\DB\DbTestCase;
use Tests\AppBundle\DB\Fixtures\ValidToken;

class TokenUserProviderTest extends DbTestCase
{
    /** @var  TokenUserProvider */
    private $tokenUserProvider;

    protected function setUp()
    {
        $doctrine = $this->getContainer()->get('doctrine');
        $this->tokenUserProvider = new TokenUserProvider($doctrine);

        $this->initialize(array(
            'Tests\AppBundle\DB\Fixtures\ValidToken'
        ));
    }

    public function testGetUserForToken()
    {
        $user = $this->tokenUserProvider->getUserForToken(ValidToken::TOKEN);
        self::assertNotNull($user);
        self::assertTrue($user instanceof User);
    }

    /**
     * @expectedException Symfony\Component\Security\Core\Exception\UsernameNotFoundException
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
     * @expectedException Symfony\Component\Security\Core\Exception\UnsupportedUserException
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