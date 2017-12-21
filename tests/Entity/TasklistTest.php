<?php

namespace App\Tests\Entity;

use App\Entity\Task;
use App\Entity\Tasklist;
use App\Entity\User;
use PHPUnit\Framework\TestCase;

class TasklistTest extends TestCase
{
    public function testGetterAndSetter()
    {
        $owner = new User();

        $tasklist = (new Tasklist())
            ->setName('Testlist')
            ->setOwner($owner);

        $this->assertEquals('Testlist', $tasklist->getName());
        $this->assertEquals($owner, $tasklist->getOwner());
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

    public function testAddAndRemoveUser()
    {
        $user1 = new User();
        $user2 = new User();

        $tasklist = (new Tasklist())
            ->addUser($user1)
            ->addUser($user2);

        $this->assertCount(2, $tasklist->getUsers());

        $tasklist->removeUser($user1);
        $this->assertCount(1, $tasklist->getUsers());
    }
}
