<?php

namespace App\Tests\DB\Fixtures;

use App\Entity\ApiToken;
use App\Entity\User;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Common\Persistence\ObjectManager;

class ValidToken extends Fixture
{
    const TOKEN = 'a1b2c3d4e5';

    public function load(ObjectManager $manager)
    {
        /** @var User $user1 */
        $user1 = null;

        try {
            $user1 = $this->getReference('user1');
        } catch (\OutOfBoundsException $e) {
            $user1 = $manager->getRepository(User::class)->findOneByUsername('foo');
        }

        $validToken = (new ApiToken())
            ->setUser($user1)
            ->setToken(self::TOKEN)
            ->setValidUntil(new \DateTime('+ 5 minutes'));

        $manager->persist($validToken);
        $manager->flush();
    }
}
