<?php
/**
 * Created by PhpStorm.
 * User: fabian
 * Date: 26.09.17
 * Time: 10:24
 */

namespace App\DataFixtures\ORM;


use App\Entity\Task;
use App\Entity\Tasklist;
use App\Entity\TaskType;
use App\Entity\User;
use App\Schema\Types\DateType;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Common\Persistence\ObjectManager;
use Symfony\Component\Security\Core\Encoder\UserPasswordEncoderInterface;

class Fixtures extends Fixture
{
    /** @var UserPasswordEncoderInterface */
    private $encoder;

    public function __construct(UserPasswordEncoderInterface $encoder)
    {
        $this->encoder = $encoder;
    }

    public function load(ObjectManager $manager)
    {
        $user1 = new User();
        $user1->setUsername('foo');
        $user1->setName('Foo');
        $user1->setFirstname('Bar');
        $user1->setEmail('foo@bar.ch');
        $password = $this->encoder->encodePassword($user1, 'test');
        $user1->setPassword($password);

        $user2 = new User();
        $user2->setUsername('bar');
        $user2->setName('Bar');
        $user2->setFirstname('Foo');
        $user2->setEmail('bar@foo.ch');
        $password = $this->encoder->encodePassword($user2, 'test');
        $user2->setPassword($password);

        $tasklist1 = new Tasklist();
        $tasklist1->setName('Home');
        $tasklist1->setOwner($user1);
        $this->addReference('tasklist1', $tasklist1);

        $tasklist2 = new Tasklist();
        $tasklist2->setName('Office');
        $tasklist2->setOwner($user1);

        $tasklist3 = new Tasklist();
        $tasklist3->setName('Büro');
        $tasklist3->setOwner($user2);
        $this->addReference('tasklist3', $tasklist3);

        $tasklist4 = new Tasklist();
        $tasklist4->setName('Shared');
        $tasklist4->setOwner($user2);
        $tasklist4->addUser($user1);

        $task1 = new Task();
        $task1->setType(TaskType::CRITICAL_NOW);
        $task1->setTitle('Buy wife flowers');
        $task1->setDescription('My wife loves flowers. It\'s critical to buy them for her.');
        $task1->setStartDate(\DateTime::createFromFormat(DateType::PARSE_FORMAT, '2017-10-20'));
        $task1->setDueDate(\DateTime::createFromFormat(DateType::PARSE_FORMAT, '2017-12-12'));
        $tasklist1->addTask($task1);
        $this->addReference('task-with-access', $task1);

        $task2 = new Task();
        $task2->setType(TaskType::OPPORTUNITY_NOW);
        $task2->setTitle('Have kids');
        $task2->setDescription('We would like to have a few children and should start in the near future.');
        $task2->setStartDate(\DateTime::createFromFormat(DateType::PARSE_FORMAT, '2018-01-15'));
        $task2->setDueDate(\DateTime::createFromFormat(DateType::PARSE_FORMAT, '2022-08-26'));
        $tasklist1->addTask($task2);

        $task3 = new Task();
        $task3->setType(TaskType::OVER_THE_HORIZON);
        $task3->setTitle('Build a house');
        $task3->setDescription('At some point I would like to own my own house.');
        $task3->setStartDate(\DateTime::createFromFormat(DateType::PARSE_FORMAT, '2020-01-01'));
        $task3->setDueDate(\DateTime::createFromFormat(DateType::PARSE_FORMAT, '2030-12-31'));
        $tasklist1->addTask($task3);

        $task4 = new Task();
        $task4->setType(TaskType::CRITICAL_NOW);
        $task4->setTitle('Boss task');
        $task4->setDescription('First I need to do what my boss asks of me.');
        $task4->setStartDate(\DateTime::createFromFormat(DateType::PARSE_FORMAT, '2017-09-26'));
        $task4->setDueDate(\DateTime::createFromFormat(DateType::PARSE_FORMAT, '2017-09-29'));
        $tasklist2->addTask($task4);

        $task5 = new Task();
        $task5->setType(TaskType::OPPORTUNITY_NOW);
        $task5->setTitle('My own task');
        $task5->setDescription('This is what I think is important. Pssst, my boss does not know about this task!');
        $task5->setStartDate(\DateTime::createFromFormat(DateType::PARSE_FORMAT, '2017-10-02'));
        $task5->setDueDate(\DateTime::createFromFormat(DateType::PARSE_FORMAT, '2017-10-06'));
        $tasklist2->addTask($task5);

        $task6 = new Task();
        $task6->setType(TaskType::CRITICAL_NOW);
        $task6->setTitle('Boss task');
        $task6->setDescription('First I need to do what my boss asks of me.');
        $task6->setStartDate(\DateTime::createFromFormat(DateType::PARSE_FORMAT, '2017-09-26'));
        $task6->setDueDate(\DateTime::createFromFormat(DateType::PARSE_FORMAT, '2017-09-29'));
        $tasklist3->addTask($task6);
        $this->addReference('task-with-no-access', $task6);

        $task7 = new Task();
        $task7->setType(TaskType::OPPORTUNITY_NOW);
        $task7->setTitle('My own task');
        $task7->setDescription('This is what I think is important. Pssst, my boss does not know about this task!');
        $task7->setStartDate(\DateTime::createFromFormat(DateType::PARSE_FORMAT, '2017-10-02'));
        $task7->setDueDate(\DateTime::createFromFormat(DateType::PARSE_FORMAT, '2017-10-06'));
        $tasklist3->addTask($task7);

        $task8 = new Task();
        $task8->setType(TaskType::CRITICAL_NOW);
        $task8->setTitle('Boss task');
        $task8->setDescription('First I need to do what my boss asks of me.');
        $task8->setStartDate(\DateTime::createFromFormat(DateType::PARSE_FORMAT, '2017-09-26'));
        $task8->setDueDate(\DateTime::createFromFormat(DateType::PARSE_FORMAT, '2017-09-29'));
        $tasklist4->addTask($task8);

        $task9 = new Task();
        $task9->setType(TaskType::OPPORTUNITY_NOW);
        $task9->setTitle('My own task');
        $task9->setDescription('This is what I think is important. Pssst, my boss does not know about this task!');
        $task9->setStartDate(\DateTime::createFromFormat(DateType::PARSE_FORMAT, '2017-10-02'));
        $task9->setDueDate(\DateTime::createFromFormat(DateType::PARSE_FORMAT, '2017-10-06'));
        $tasklist4->addTask($task9);

        $manager->persist($user1);
        $manager->persist($user2);
        $manager->persist($task1);
        $manager->persist($task2);
        $manager->persist($task3);
        $manager->persist($task4);
        $manager->persist($task5);
        $manager->persist($task6);
        $manager->persist($task7);
        $manager->persist($task8);
        $manager->persist($task9);
        $manager->persist($tasklist1);
        $manager->persist($tasklist2);
        $manager->persist($tasklist3);
        $manager->persist($tasklist4);
        $manager->flush();
    }
}