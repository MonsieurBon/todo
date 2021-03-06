<?php

namespace App\Tests\Security;

use App\Security\TaskVoter;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;

class TaskVoterMock extends TaskVoter
{
    public function testSupports($attribute, $subject)
    {
        return $this->supports($attribute, $subject);
    }

    public function testVoteOnAttribute($attribute, $subject, TokenInterface $token)
    {
        return $this->voteOnAttribute($attribute, $subject, $token);
    }
}
