<?php

namespace App\Tests\Entity;

use App\Entity\Task;
use App\Entity\Tasklist;
use App\Entity\TaskType;
use PHPUnit\Framework\TestCase;

class TaskTest extends TestCase
{
    public function testSimpleGetterAndSetter()
    {
        $startdate = new \DateTime('+ 1 day');
        $duedate = new \DateTime('+ 2 days');

        $task = (new Task())
            ->setTitle('My Title')
            ->setDescription('My Description')
            ->setType(TaskType::CRITICAL_NOW)
            ->setStartDate($startdate)
            ->setDueDate($duedate);

        $this->assertNull($task->getId());
        $this->assertEquals('My Title', $task->getTitle());
        $this->assertEquals('My Description', $task->getDescription());
        $this->assertEquals(TaskType::CRITICAL_NOW, $task->getType());
        $this->assertEquals($startdate, $task->getStartDate());
        $this->assertEquals($duedate, $task->getDueDate());
    }

    /**
     * @expectedException \UnexpectedValueException
     * @expectedExceptionMessageRegExp /^Invalid value for TaskType$/
     */
    public function testInvalidTaskType()
    {
        $task = (new Task())
            ->setType('random type');
    }

    public function testGetAndSetTasklist()
    {
        $tasklist1 = new Tasklist();
        $tasklist2 = new Tasklist();

        $task1 = new Task();
        $task2 = new Task();

        $task1->setTasklist($tasklist1);
        $this->assertEquals($tasklist1, $task1->getTasklist());
        $this->assertCount(1, $tasklist1->getTasks());

        $task2->setTasklist($tasklist1);
        $this->assertEquals($tasklist1, $task2->getTasklist());
        $this->assertCount(2, $tasklist1->getTasks());

        $task2->setTasklist(null);
        $this->assertNull($task2->getTasklist());
        $this->assertCount(1, $tasklist1->getTasks());

        $task1->setTasklist($tasklist2);
        $this->assertEquals($tasklist2, $task1->getTasklist());
        $this->assertCount(0, $tasklist1->getTasks());
        $this->assertCount(1, $tasklist2->getTasks());
    }
}
