<?php
/**
 * Created by PhpStorm.
 * User: fabian
 * Date: 06.10.17
 * Time: 18:05
 */

namespace tests\AppBundle\Entity;


use AppBundle\Entity\Task;
use AppBundle\Entity\Tasklist;
use PHPUnit\Framework\TestCase;

class TasklistTest extends TestCase
{
    public function testGetterAndSetter()
    {
        $tasklist = (new Tasklist())
            ->setName('Testlist');

        $this->assertEquals('Testlist', $tasklist->getName());
    }

    public function testRemoveAllTasks()
    {
        $tasklist = new Tasklist();
        $task1 = new Task();
        $task2 = new Task();
        $task3 = new Task();

        $tasklist->addTask($task1);
        $tasklist->addTask($task2);
        $tasklist->addTask($task3);

        $this->assertCount(3, $tasklist->getTasks());
        $this->assertEquals($tasklist, $task1->getTasklist());
        $this->assertEquals($tasklist, $task2->getTasklist());
        $this->assertEquals($tasklist, $task3->getTasklist());

        $tasklist->removeAllTasks();

        $this->assertCount(0, $tasklist->getTasks());
        $this->assertNull($task1->getTasklist());
        $this->assertNull($task2->getTasklist());
        $this->assertNull($task3->getTasklist());
    }
}