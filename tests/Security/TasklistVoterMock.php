<?php

namespace App\Tests\Security;

use App\Security\TasklistVoter;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;

class TasklistVoterMock extends TasklistVoter
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
