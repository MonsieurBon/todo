<?php
/**
 * Created by PhpStorm.
 * User: fabian
 * Date: 26.09.17
 * Time: 10:24
 */

namespace AppBundle\DataFixtures\ORM;


use AppBundle\Entity\Task;
use AppBundle\Entity\Tasklist;
use AppBundle\Entity\TaskType;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Common\Persistence\ObjectManager;

class Fixtures extends Fixture
{
    public function load(ObjectManager $manager)
    {
        $tasklist1 = new Tasklist();
        $tasklist1->setName('Home');

        $tasklist2 = new Tasklist();
        $tasklist2->setName('Office');

        $task1 = new Task();
        $task1->setType(TaskType::CRITICAL_NOW);
        $task1->setTitle('Buy wife flowers');
        $task1->setDescription('My wife loves flowers. It\'s critical to buy them for her.');
        $task1->setStartDate(\DateTime::createFromFormat('!Y-m-d', '2017-10-20'));
        $task1->setDueDate(\DateTime::createFromFormat('!Y-m-d', '2017-12-12'));
        $tasklist1->addTask($task1);

        $task2 = new Task();
        $task2->setType(TaskType::OPPORTUNITY_NOW);
        $task2->setTitle('Have kids');
        $task2->setDescription('We would like to have a few children and should start in the near future.');
        $task2->setStartDate(\DateTime::createFromFormat('!Y-m-d', '2018-01-15'));
        $task2->setDueDate(\DateTime::createFromFormat('!Y-m-d', '2022-08-26'));
        $tasklist1->addTask($task2);

        $task3 = new Task();
        $task3->setType(TaskType::OVER_THE_HORIZON);
        $task3->setTitle('Build a house');
        $task3->setDescription('At some point I would like to own my own house.');
        $task3->setStartDate(\DateTime::createFromFormat('!Y-m-d', '2020-01-01'));
        $task3->setDueDate(\DateTime::createFromFormat('!Y-m-d', '2030-12-31'));
        $tasklist1->addTask($task3);

        $task4 = new Task();
        $task4->setType(TaskType::CRITICAL_NOW);
        $task4->setTitle('Boss task');
        $task4->setDescription('First I need to do what my boss asks of me.');
        $task4->setStartDate(\DateTime::createFromFormat('!Y-m-d', '2017-09-26'));
        $task4->setDueDate(\DateTime::createFromFormat('!Y-m-d', '2017-09-29'));
        $tasklist2->addTask($task4);

        $task5 = new Task();
        $task5->setType(TaskType::OPPORTUNITY_NOW);
        $task5->setTitle('My own task');
        $task5->setDescription('This is what I think is important. Pssst, my boss does not know about this task!');
        $task5->setStartDate(\DateTime::createFromFormat('!Y-m-d', '2017-10-02'));
        $task5->setDueDate(\DateTime::createFromFormat('!Y-m-d', '2017-10-06'));
        $tasklist2->addTask($task5);

        $manager->persist($task1);
        $manager->persist($task2);
        $manager->persist($task3);
        $manager->persist($task4);
        $manager->persist($task5);
        $manager->persist($tasklist1);
        $manager->persist($tasklist2);
        $manager->flush();
    }
}