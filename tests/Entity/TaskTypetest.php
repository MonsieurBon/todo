<?php

namespace App\Tests\Entity;

use App\Entity\TaskType;
use PHPUnit\Framework\TestCase;

class TaskTypetest extends TestCase
{
    public function testValues()
    {
        $this->assertCount(3, TaskType::values());
    }
}
