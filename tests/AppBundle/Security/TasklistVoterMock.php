<?php
/**
 * Created by PhpStorm.
 * User: fabian
 * Date: 19.10.17
 * Time: 07:07
 */

namespace Tests\AppBundle\Security;


use AppBundle\Security\TasklistVoter;
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