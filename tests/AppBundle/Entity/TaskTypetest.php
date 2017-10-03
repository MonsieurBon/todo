<?php
/**
 * Created by PhpStorm.
 * User: fabian
 * Date: 03.10.17
 * Time: 21:42
 */

namespace Tests\AppBundle\Entity;


use AppBundle\Entity\TaskType;
use PHPUnit\Framework\TestCase;

class TaskTypetest extends TestCase
{
    public function testValues()
    {
        $this->assertCount(3, TaskType::values());
    }
}