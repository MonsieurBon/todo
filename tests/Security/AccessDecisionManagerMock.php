<?php

namespace App\Tests\Security;

use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\AccessDecisionManagerInterface;

class AccessDecisionManagerMock implements AccessDecisionManagerInterface
{
    public function decide(TokenInterface $token, array $attributes, $object = null)
    {
        $tasklistVoter = new TasklistVoterMock();

        return $tasklistVoter->testVoteOnAttribute($attributes[0], $object, $token);
    }
}
