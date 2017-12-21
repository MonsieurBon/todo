<?php

namespace App\Tests\Security;

use App\Entity\Task;
use App\Entity\Tasklist;
use App\Entity\User;
use App\Security\TasklistVoter;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\User\User as CoreUser;

class TasklistVoterTest extends TestCase
{
    public function testSupports()
    {
        $tasklistVoter = new TasklistVoterMock();

        $tasklist = new Tasklist();
        $task = new Task();

        /** @var TokenInterface $token */
        $token = $this->createMock(TokenInterface::class);

        self::assertFalse($tasklistVoter->testSupports('foobar', $tasklist));
        self::assertFalse($tasklistVoter->testSupports(TasklistVoter::ACCESS, $task));
        self::assertTrue($tasklistVoter->testSupports(TasklistVoter::ACCESS, $tasklist));
        self::assertTrue($tasklistVoter->testSupports(TasklistVoter::OWNER, $tasklist));
    }

    public function testVoteOnAttribute()
    {
        $tasklistVoter = new TasklistVoterMock();

        $tasklist = new Tasklist();
        $user = new User();
        $invalidUser = new CoreUser('foo', 'bar');

        /** @var TokenInterface $token */
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn($invalidUser);

        $vote = $tasklistVoter->testVoteOnAttribute(TasklistVoter::ACCESS, $tasklist, $token);
        self::assertFalse($vote);

        /** @var TokenInterface $token */
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn($user);

        $vote = $tasklistVoter->testVoteOnAttribute(TasklistVoter::ACCESS, $tasklist, $token);
        self::assertFalse($vote);

        $vote = $tasklistVoter->testVoteOnAttribute(TasklistVoter::OWNER, $tasklist, $token);
        self::assertFalse($vote);

        $tasklist->addUser($user);

        $vote = $tasklistVoter->testVoteOnAttribute(TasklistVoter::ACCESS, $tasklist, $token);
        self::assertTrue($vote);

        $vote = $tasklistVoter->testVoteOnAttribute(TasklistVoter::OWNER, $tasklist, $token);
        self::assertFalse($vote);

        $tasklist->removeUser($user);
        $tasklist->setOwner($user);

        $vote = $tasklistVoter->testVoteOnAttribute(TasklistVoter::ACCESS, $tasklist, $token);
        self::assertTrue($vote);

        $vote = $tasklistVoter->testVoteOnAttribute(TasklistVoter::OWNER, $tasklist, $token);
        self::assertTrue($vote);
    }

    /**
     * @expectedException \LogicException
     * @expectedExceptionMessage This code should not be reached!
     */
    public function testVoteOnUnsupportedAttribute()
    {
        $tasklistVoter = new TasklistVoterMock();

        $tasklist = new Tasklist();
        $user = new User();

        /** @var TokenInterface $token */
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn($user);

        $vote = $tasklistVoter->testVoteOnAttribute('invalid_attribute', $tasklist, $token);
    }
}
