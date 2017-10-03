<?php

namespace Tests\AppBundle\Repository;

use AppBundle\Entity\ApiToken;
use Doctrine\ORM\EntityManager;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;

class ApiTokenRepositoryTest extends KernelTestCase
{
    /**
     * @var EntityManager
     */
    private $em;
    private static $VALID_TOKEN_STRING = '12345';
    private static $INVALID_TOKEN_STRING = '54321';
    private $tokens = array();

    protected function setUp()
    {
        self::bootKernel();

        $this->em = static::$kernel->getContainer()
            ->get('doctrine')
            ->getManager();

        $validToken = new ApiToken();
        $validToken->setToken(self::$VALID_TOKEN_STRING);
        $validToken->setValidUntil(new \DateTime('+ 5 minutes'));

        $this->tokens[] = $validToken;
        $this->em->persist($validToken);

        $invalidToken = new ApiToken();
        $invalidToken->setToken(self::$INVALID_TOKEN_STRING);
        $invalidToken->setValidUntil(new \DateTime('- 5 minutes'));

        $this->tokens[] = $invalidToken;
        $this->em->persist($invalidToken);
        $this->em->flush();
    }

    public function testFindValidToken()
    {
        $token = $this->em
            ->getRepository(ApiToken::class)
            ->findValidToken(self::$VALID_TOKEN_STRING);

        $this->assertNotNull($token);
        $this->assertTrue($token->getValidUntil() > new \DateTime('now'));
    }

    public function testInvalidTokensAreNotReturned()
    {
        $token = $this->em
            ->getRepository(ApiToken::class)
            ->findValidToken(self::$INVALID_TOKEN_STRING);

        $this->assertNull($token);
    }

    protected function tearDown()
    {
        foreach($this->tokens as $token) {
            $this->em->remove($token);
        }
        $this->em->flush();

        parent::tearDown();

        $this->em->close();
        $this->em = null;
    }

}