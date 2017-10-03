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
        $doctrine = static::$kernel->getContainer()
            ->get('doctrine');

        $schema = new Schema($doctrine);

        $this->assertNotNull($schema);
        $this->assertTrue($schema->getQueryType() instanceof QueryType);
        $this->assertTrue($schema->getMutationType() instanceof MutationType);
    }

    protected function tearDown()
    {
        parent::tearDown();
    }
}