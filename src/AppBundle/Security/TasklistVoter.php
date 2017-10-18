<?php
/**
 * Created by PhpStorm.
 * User: fabian
 * Date: 12.10.17
 * Time: 17:19
 */

namespace AppBundle\Security;


use AppBundle\Entity\Tasklist;
use AppBundle\Entity\User;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\Voter;

class TasklistVoter extends Voter
{

    const ACCESS = 'access';
    const OWNER = 'owner';

    /**
     * Determines if the attribute and subject are supported by this voter.
     *
     * @param string $attribute An attribute
     * @param mixed $subject The subject to secure, e.g. an object the user wants to access or any other PHP type
     *
     * @return bool True if the attribute and subject are supported, false otherwise
     */
    protected function supports($attribute, $subject)
    {
        if (!in_array($attribute, array(self::OWNER, self::ACCESS))) {
            return false;
        }

        if (!$subject instanceof Tasklist) {
            return false;
        }

        return true;
    }

    /**
     * Perform a single access check operation on a given attribute, subject and token.
     * It is safe to assume that $attribute and $subject already passed the "supports()" method check.
     *
     * @param string $attribute
     * @param mixed $subject
     * @param TokenInterface $token
     *
     * @return bool
     */
    protected function voteOnAttribute($attribute, $subject, TokenInterface $token)
    {
        $user = $token->getUser();

        if (!$user instanceof User) {
            return false;
        }

        /** @var Tasklist $tasklist */
        $tasklist = $subject;

        switch ($attribute) {
            case self::OWNER:
                return $this->isOwner($tasklist, $user);
            case self::ACCESS:
                return $this->canAccess($tasklist, $user);
            default:
                throw new \LogicException('This code should not be reached!');
        }
    }

    /**
     * @param Tasklist $tasklist
     * @param User $user
     * @return bool
     */
    private function isOwner($tasklist, $user)
    {
        return $tasklist->getOwner() === $user;
    }

    /**
     * @param Tasklist $tasklist
     * @param User $user
     * @return mixed
     */
    private function canAccess($tasklist, $user)
    {
        if ($this->isOwner($tasklist, $user)) {
            return true;
        }

        return $tasklist->getUsers()->contains($user);
    }
}