<?php
/**
 * Created by PhpStorm.
 * User: fabian
 * Date: 20.10.17
 * Time: 17:07
 */

namespace Tests\AppBundle\Security;


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