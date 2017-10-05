<?php
/**
 * Created by PhpStorm.
 * User: fabian
 * Date: 29.09.17
 * Time: 07:01
 */

namespace AppBundle\Schema\Types\Mutation;


use AppBundle\Entity\ApiToken;
use AppBundle\Entity\User;
use AppBundle\Schema\Types;
use Doctrine\Bundle\DoctrineBundle\Registry;
use GraphQL\Type\Definition\ObjectType;
use GraphQL\Type\Definition\ResolveInfo;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\Security\Core\Encoder\UserPasswordEncoder;

class LoginType extends ObjectType
{
    /**
     * @var Registry
     */
    private $doctrine;
    /**
     * @var UserPasswordEncoder
     */
    private $encoder;
    private $sessionTimeout;

    public function __construct(ContainerInterface $container)
    {
        $this->doctrine = $container->get('doctrine');
        $this->encoder = $container->get('security.password_encoder');
        $this->sessionTimeout = $container->getParameter('app.session_timeout');

        $config = [
            'name' => 'Login',
            'fields' => [
                'createToken' => [
                    'type' => new ObjectType([
                        'name' => 'Credentials',
                        'fields' => [
                            'token' => Types::string(),
                            'error' => Types::string()
                        ],
                        'resolveField' => function ($val, $args, $context, ResolveInfo $info)
                        {
                            $methodName = 'resolve' . ucfirst($info->fieldName);
                            return $this->{$methodName}($val);
                        }
                    ]),
                    'args' => [
                        'username' => Types::nonNull(Types::string()),
                        'password' => Types::nonNull(Types::string())
                    ]
                ]
            ],
            'resolveField' => function ($val, $args, $context, ResolveInfo $info)
            {
                return $this->{$info->fieldName}($args);
            }
        ];
        parent::__construct($config);
    }

    private function createToken($args)
    {
        $em = $this->doctrine->getManager();
        $userRepo = $this->doctrine->getRepository(User::class);

        $username = $args['username'];
        $password = $args['password'];

        /** @var User $user */
        $user = $userRepo->findOneByUsername($username);

        if ($user === null) {
            return array(
                'error' => 'Invalid username or password'
            );
        }

        if (!$this->encoder->isPasswordValid($user, $password)) {
            return array(
                'error' => 'Invalid username or password'
            );
        }

        $oldToken = $user->getApiToken();
        if ($oldToken) {
            $em->remove($oldToken);
            $em->flush();
        }

        $tokenString = bin2hex(openssl_random_pseudo_bytes(16));
        $validUntil = (new \DateTime('now'))
            ->add(new \DateInterval('PT' . $this->sessionTimeout . 'M'));

        $token = (new ApiToken())
            ->setUser($user)
            ->setValidUntil($validUntil)
            ->setToken($tokenString);

        $em->persist($token);
        $em->flush();

        return array(
            'token' => $tokenString
        );
    }

    private function resolveToken($val) {
        if (array_key_exists('token', $val)
            && !array_key_exists('error', $val)) {
            return $val['token'];
        }

        return null;
    }

    private function resolveError($val) {
        return array_key_exists('error', $val) ? $val['error'] : null;
    }
}