<?php
/**
 * Created by PhpStorm.
 * User: fabian
 * Date: 04.10.17
 * Time: 06:41
 */

namespace Tests\AppBundle\Security;


use AppBundle\Entity\ApiToken;
use AppBundle\Entity\User;
use AppBundle\Security\TokenAuthenticator;
use AppBundle\Security\TokenUserProvider;
use Doctrine\ORM\EntityManager;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Security\Core\Authentication\Token\PreAuthenticatedToken;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Exception\AuthenticationException;
use Symfony\Component\Security\Core\User\UserProviderInterface;

class TokenAuthenticatorTest extends KernelTestCase
{
    const TOKEN = 'a1b2c3';
    const PROVIDER_KEY = 'api';

    /**
     * @var TokenAuthenticator
     */
    private $authenticator;
    /**
     * @var EntityManager
     */
    private $em;
    private $objects = array();

    protected function setUp()
    {
        static::bootKernel();

        $container = static::$kernel->getContainer();
        $doctrine = static::$kernel->getContainer()->get('doctrine');

        $this->authenticator = new TokenAuthenticator(
            $container,
            static::$kernel,
            $doctrine
        );

        $this->em = $doctrine->getManager();

        $user = new User();
        $user->setUsername('test');
        $user->setPassword('1234');
        $user->setEmail('test@bar.ch');
        $user->setName('Test');
        $user->setFirstname('User');
        $this->objects[] = $user;
        $this->em->persist($user);

        $token = new ApiToken();
        $token->setToken(self::TOKEN);
        $token->setValidUntil(new \DateTime('+ 10 seconds'));
        $token->setUser($user);
        $this->objects[] = $token;
        $this->em->persist($token);

        $this->em->flush();
    }

    public function testXAuthTokenHeader()
    {
        $request = new Request();
        $request->headers->set(TokenAuthenticator::X_AUTH_HEADER, self::TOKEN);

        /** @var PreAuthenticatedToken $credentials */
        $credentials = $this->authenticator->createToken($request, self::PROVIDER_KEY);

        self::assertEquals('anon.', $credentials->getUsername());
        self::assertEquals(self::TOKEN, $credentials->getCredentials());
        self::assertEquals(self::PROVIDER_KEY, $credentials->getProviderKey());
    }

    public function testTokenUrlParameter()
    {
        $request = new Request();
        $request->headers->set(TokenAuthenticator::X_AUTH_HEADER, self::TOKEN);
        $request->query->set('token', 'd4e5f6');

        /** @var PreAuthenticatedToken $credentials */
        $credentials = $this->authenticator->createToken($request, self::PROVIDER_KEY);

        self::assertEquals('anon.', $credentials->getUsername());
        self::assertEquals(self::TOKEN, $credentials->getCredentials());
        self::assertEquals(self::PROVIDER_KEY, $credentials->getProviderKey());
    }

    public function testHeaderTakesPrecedence()
    {
        $request = new Request();
        $request->headers->set(TokenAuthenticator::X_AUTH_HEADER, self::TOKEN);
        $request->query->set('token', 'some_other_token');

        /** @var PreAuthenticatedToken $credentials */
        $credentials = $this->authenticator->createToken($request, self::PROVIDER_KEY);

        self::assertEquals('anon.', $credentials->getUsername());
        self::assertEquals(self::TOKEN, $credentials->getCredentials());
        self::assertEquals(self::PROVIDER_KEY, $credentials->getProviderKey());
    }

    public function testSupportsToken()
    {
        // wrong token class
        /** @var TokenInterface $mockToken */
        $mockToken = $this->createMock(TokenInterface::class);
        self::assertFalse($this->authenticator->supportsToken($mockToken, self::PROVIDER_KEY));

        // providerKey does not match
        $token = new PreAuthenticatedToken(
            'anon.',
            self::TOKEN,
            self::PROVIDER_KEY
        );
        self::assertFalse($this->authenticator->supportsToken($token, 'foo'));

        self::assertTrue($this->authenticator->supportsToken($token, self::PROVIDER_KEY));
    }

    /**
     * @expectedException \InvalidArgumentException
     * @expectedExceptionMessageRegExp /^The user provider must be an instance of ApiKeyUserProvider/
     */
    public function testAuthenticateTokenInvalidUserProvider()
    {
        /** @var UserProviderInterface $userProvider */
        $userProvider = $this->createMock(UserProviderInterface::class);

        $preAuthToken = new PreAuthenticatedToken(
            'anon.',
            self::TOKEN,
            self::PROVIDER_KEY
        );

        $this->authenticator->authenticateToken($preAuthToken, $userProvider, self::PROVIDER_KEY);
    }

    /**
     * @expectedException Symfony\Component\Security\Core\Exception\BadCredentialsException
     */
    public function testAuthenticateTokenNoUserFound()
    {
        /** @var TokenUserProvider $userProvider */
        $userProvider = $this->createMock(TokenUserProvider::class);

        $preAuthToken = new PreAuthenticatedToken(
            'anon.',
            'invalid_token',
            self::PROVIDER_KEY
        );

        $this->authenticator->authenticateToken($preAuthToken, $userProvider, self::PROVIDER_KEY);
    }

    public function testAuthenticateTokenSuccessfull()
    {
        /** @var User $user */
        $user = $this->em
            ->getRepository(User::class)
            ->findOneByUsername('test');

        /** @var TokenUserProvider $userProvider */
        $userProvider = $this->createMock(TokenUserProvider::class);
        $userProvider->method('getUserForToken')->willReturn($user);

        $preAuthToken = new PreAuthenticatedToken(
            'anon.',
            self::TOKEN,
            self::PROVIDER_KEY
        );

        $finalPreAuthToken = $this->authenticator->authenticateToken($preAuthToken, $userProvider, self::PROVIDER_KEY);
        self::assertNotNull($finalPreAuthToken);
        self::assertEquals($user, $finalPreAuthToken->getUser());
        self::assertEquals(self::TOKEN, $finalPreAuthToken->getCredentials());
        self::assertEquals(self::PROVIDER_KEY, $finalPreAuthToken->getProviderKey());
    }

    public function testOnAuthenticationFailure()
    {
        $request = new Request(
            array(),
            array(
                'query' => '',
                'variables' => null
            ),
            array(
                '_format' => 'json',
                '_controller' => 'AppBundle\Controller\ApiController::indexAction',
                '_route' => 'app_api_index',
                '_route_params' => array(
                    '_format' => 'json'
                ),
                '_firewall_context' => 'security.firewall.map.context.api'
            ),
            array(),
            array(),
            array(),
            '{"query":"","variables":null}'
        );

        $exception = new AuthenticationException();

        $response = $this->authenticator->onAuthenticationFailure($request, $exception);

        self::assertNotNull($response);
        self::assertEquals(200, $response->getStatusCode());
        self::assertEquals(
            '{"data":{"hello":"Your GraphQL endpoint is ready! Please log in to see the full API."}}',
            $response->getContent()
        );
    }

    protected function tearDown()
    {
        foreach (array_reverse($this->objects) as $object) {
            $this->em->remove($object);
        }
        $this->em->flush();

        parent::tearDown();

        $this->em->close();
        $this->em = null;
    }
}