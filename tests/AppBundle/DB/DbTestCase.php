<?php
/**
 * Created by PhpStorm.
 * User: fabian
 * Date: 13.10.17
 * Time: 07:22
 */

namespace Tests\AppBundle\DB;


use Doctrine\Common\DataFixtures\ReferenceRepository;
use Tests\AppBundle\Base\WebTestCase;

class DbTestCase extends WebTestCase
{
    /** @var  ReferenceRepository */
    protected $fixtures;

    protected function setUp()
    {
        $this->initialize();
    }

    protected function initialize(array $additionalFixtures = array()) {
        $baseFixtures = array(
            'AppBundle\DataFixtures\ORM\Fixtures'
        );

        $fixtures = array_merge($baseFixtures, $additionalFixtures);

        $this->fixtures = $this->loadFixtures($fixtures)->getReferenceRepository();
    }
}