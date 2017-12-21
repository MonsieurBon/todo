<?php

namespace App\Tests\DB;

use Doctrine\Common\DataFixtures\ReferenceRepository;
use App\Tests\Base\WebTestCase;

class DbTestCase extends WebTestCase
{
    /** @var ReferenceRepository */
    protected $fixtures;

    protected function setUp()
    {
        $this->initialize();
    }

    protected function initialize(array $additionalFixtures = [])
    {
        $baseFixtures = [
            'App\DataFixtures\ORM\Fixtures'
        ];

        $fixtures = array_merge($baseFixtures, $additionalFixtures);

        $this->fixtures = $this->loadFixtures($fixtures)->getReferenceRepository();
    }
}
