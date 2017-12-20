<?php
/**
 * Created by PhpStorm.
 * User: fabian
 * Date: 17.10.17
 * Time: 16:43
 */

namespace App\Security;


use App\Entity\ApiToken;
use App\Entity\User;
use App\Repository\ApiTokenRepository;
use App\Repository\UserRepository;
use Doctrine\Bundle\DoctrineBundle\Registry;
use Symfony\Bridge\Doctrine\RegistryInterface;
use Symfony\Component\Security\Core\Exception\UnsupportedUserException;
use Symfony\Component\Security\Core\Exception\UsernameNotFoundException;
use Symfony\Component\Security\Core\User\UserInterface;
use Symfony\Component\Security\Core\User\UserProviderInterface;

class TokenUserProvider implements UserProviderInterface
{
    /** @var ApiTokenRepository */
    private $apiTokenRepo;
    /** @var UserRepository */
    private $userRepo;

    public function __construct(RegistryInterface $doctrine)
    {
        $this->apiTokenRepo = $doctrine->getRepository(ApiToken::class);
        $this->userRepo = $doctrine->getRepository(User::class);
    }

    /**
     * @param $token string
     * @return User|null
     */
    public function getUserForToken($token)
    {
        $apiToken = $this->apiTokenRepo->findValidToken($token);
        return $apiToken != null ? $apiToken->getUser() : null;
    }

    /**
     * Loads the user for the given username.
     *
     * This method must throw UsernameNotFoundException if the user is not
     * found.
     *
     * @param string $username The username
     *
     * @return UserInterface
     *
     * @throws UsernameNotFoundException if the user is not found
     */
    public function loadUserByUsername($username)
    {
        $user = $this->userRepo->findOneByUsername($username);

        if ($user !== null) {
            return $user;
        }

        throw new UsernameNotFoundException();
    }

    /**
     * Refreshes the user.
     *
     * It is up to the implementation to decide if the user data should be
     * totally reloaded (e.g. from the database), or if the UserInterface
     * object can just be merged into some internal array of users / identity
     * map.
     *
     * @param UserInterface $user
     *
     * @return UserInterface
     *
     * @throws UnsupportedUserException if the user is not supported
     */
    public function refreshUser(UserInterface $user)
    {
        throw new UnsupportedUserException();
    }

    /**
     * Whether this provider supports the given user class.
     *
     * @param string $class
     *
     * @return bool
     */
    public function supportsClass($class)
    {
        return User::class === $class;
    }
}