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
use Doctrine\ORM\EntityManager;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Exception\AuthenticationException;
use Symfony\Component\Security\Core\User\UserProviderInterface;

class TokenAuthenticatorTest extends KernelTestCase
{
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
        $user->setEmail('foo@bar.ch');
        $user->setName('Test');
        $user->setFirstname('User');
        $this->objects[] = $user;
        $this->em->persist($user);

        $token = new ApiToken();
        $token->setToken('a1b2c3');
        $token->setValidUntil(new \DateTime('+ 10 seconds'));
        $token->setUser($user);
        $this->objects[] = $token;
        $this->em->persist($token);

        $this->em->flush();
    }

    public function testStart()
    {
        $request = new Request();

        $response = $this->authenticator->start($request);
        $this->assertEquals(401, $response->getStatusCode());
        $this->assertEquals('Auth header required', $response->getContent());
    }

    public function testXAuthTokenHeader()
    {
        $request = new Request();
        $request->headers->set('X-AUTH-TOKEN', 'a1b2c3');

        $credentials = $this->authenticator->getCredentials($request);

        $this->assertCount(1, $credentials);
        $this->assertArrayHasKey('token', $credentials);
        $this->assertEquals('a1b2c3', $credentials['token']);
    }

    public function testTokenUrlParameter()
    {
        $request = new Request();
        $request->headers->set('X-AUTH-TOKEN', 'a1b2c3');
        $request->query->set('token', 'd4e5f6');

        $credentials = $this->authenticator->getCredentials($request);

        $this->assertCount(1, $credentials);
        $this->assertArrayHasKey('token', $credentials);
        $this->assertEquals('a1b2c3', $credentials['token']);
    }

    public function testHeaderTakesPrecedence()
    {
        $request = new Request();
        $request->query->set('token', 'a1b2c3');

        $credentials = $this->authenticator->getCredentials($request);

        $this->assertCount(1, $credentials);
        $this->assertArrayHasKey('token', $credentials);
        $this->assertEquals('a1b2c3', $credentials['token']);
    }

    public function testGetUser()
    {
        /** @var UserProviderInterface $userProvider */
        $userProvider = $this->createMock(UserProviderInterface::class);

        $user = $this->authenticator->getUser(null, $userProvider);
        $this->assertNull($user);

        $credentials = array(
            'token' => 'a1b2c3'
        );

        $user = $this->authenticator->getUser($credentials, $userProvider);
        $this->assertNotNull($user);
    }

    public function testCheckCredentials()
    {
        $check = $this->authenticator->checkCredentials(null, new User());
        $this->assertTrue($check);
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

        $this->assertNotNull($response);
        $this->assertEquals(200, $response->getStatusCode());
        $this->assertEquals(
            '{"data":{"hello":"Your GraphQL endpoint is ready! Please log in to see the full API."}}',
            $response->getContent()
        );
    }

    public function testOnAuthenticationSuccess()
    {
        /** @var User $user */
        $user = $this->em
            ->getRepository(User::class)
            ->findOneByUsername('test');

        $validUntil = $user->getApiToken()->getValidUntil();

        $request = new Request();

        /** @var TokenInterface $tokenInterface */
        $tokenInterface = $this->createMock(TokenInterface::class);
        $tokenInterface->method('getUser')->willReturn($user);

        $this->authenticator->onAuthenticationSuccess($request, $tokenInterface, null);

        $user = $this->em
            ->getRepository(User::class)
            ->findOneByUsername('test');
        $token = $user->getApiToken();

        $this->assertTrue($token->getValidUntil() > $validUntil);
    }

    public function testDoesNotSupportRememberMe()
    {
        $rememberMe = $this->authenticator->supportsRememberMe();
        $this->assertFalse($rememberMe);
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