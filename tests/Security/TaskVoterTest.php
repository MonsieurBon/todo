<?php
/**
 * Created by PhpStorm.
 * User: fabian
 * Date: 20.10.17
 * Time: 07:28
 */

namespace App\Tests\Security;


use App\Entity\Task;
use App\Entity\Tasklist;
use App\Entity\User;
use App\Security\TaskVoter;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\AccessDecisionManagerInterface;
use Symfony\Component\Security\Core\User\User as CoreUser;

class TaskVoterTest extends TestCase
{
    public function testSupports()
    {
        $decisionManager = new AccessDecisionManagerMock();
        $taskVoter = new TaskVoterMock($decisionManager);

        $tasklist = new Tasklist();
        $task = new Task();

        self::assertFalse($taskVoter->testSupports('foobar', $task));
        self::assertFalse($taskVoter->testSupports(TaskVoter::ACCESS, $tasklist));
        self::assertTrue($taskVoter->testSupports(TaskVoter::ACCESS, $task));
    }

    public function testVoteOnAttribute()
    {
        $decisionManager = new AccessDecisionManagerMock();
        $taskVoter = new TaskVoterMock($decisionManager);

        $tasklist = new Tasklist();
        $task = (new Task())->setTasklist($tasklist);
        $user = new User();
        $invalidUser = new CoreUser('foo', 'bar');

        /** @var TokenInterface $token */
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn($invalidUser);

        $vote = $taskVoter->testVoteOnAttribute(TaskVoter::ACCESS, $task, $token);
        self::assertFalse($vote);

        /** @var TokenInterface $token */
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn($user);

        $vote = $taskVoter->testVoteOnAttribute(TaskVoter::ACCESS, $task, $token);
        self::assertFalse($vote);

        $tasklist->addUser($user);

        $vote = $taskVoter->testVoteOnAttribute(TaskVoter::ACCESS, $task, $token);
        self::assertTrue($vote);

        $tasklist->removeUser($user);
        $tasklist->setOwner($user);

        $vote = $taskVoter->testVoteOnAttribute(TaskVoter::ACCESS, $task, $token);
        self::assertTrue($vote);
    }

    /**
     * @expectedException \LogicException
     * @expectedExceptionMessage This code should not be reached!
     */
    public function testVoteOnUnsupportedAttribute()
    {
        $decisionManager = new AccessDecisionManagerMock();
        $tasklistVoter = new TaskVoterMock($decisionManager);

        $task = new Task();
        $user = new User();

        /** @var TokenInterface $token */
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn($user);

        $vote = $tasklistVoter->testVoteOnAttribute('invalid_attribute', $task, $token);
    }
}