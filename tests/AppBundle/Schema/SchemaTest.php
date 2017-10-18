<?php

namespace Tests\AppBundle\Schema;

use AppBundle\Schema\Schema;
use AppBundle\Schema\Types\Mutation\MutationType;
use AppBundle\Schema\Types\Query\QueryType;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;

class SchemaTest extends KernelTestCase
{
    protected function setUp()
    {
        self::bootKernel();
    }

    public function testCanBeCreated()
    {
        $container = static::$kernel->getContainer();
        $authChecker = $container->get('security.authorization_checker');
        $doctrine = $container->get('doctrine');
        $tokenStorage = $container->get('security.token_storage');

        $schema = new Schema($authChecker, $doctrine, $tokenStorage);

        $this->assertNotNull($schema);
        $this->assertTrue($schema->getQueryType() instanceof QueryType);
        $this->assertTrue($schema->getMutationType() instanceof MutationType);
    }

    protected function tearDown()
    {
        parent::tearDown();
    }
}