<?php

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
    const TOKEN_FIELD_NAME = 'token';
    const ERROR_FIELD_NAME = 'error';
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
                            LoginType::TOKEN_FIELD_NAME => Types::string(),
                            LoginType::ERROR_FIELD_NAME => Types::string()
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

    /** @noinspection PhpUnusedPrivateMethodInspection */
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
                LoginType::ERROR_FIELD_NAME => 'Invalid username or password'
            );
        }

        if (!$this->encoder->isPasswordValid($user, $password)) {
            return array(
                LoginType::ERROR_FIELD_NAME => 'Invalid username or password'
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
            LoginType::TOKEN_FIELD_NAME => $tokenString
        );
    }

    /** @noinspection PhpUnusedPrivateMethodInspection */
    private function resolveToken($val) {
        if (array_key_exists(LoginType::TOKEN_FIELD_NAME, $val)
            && !array_key_exists(LoginType::ERROR_FIELD_NAME, $val)) {
            return $val[LoginType::TOKEN_FIELD_NAME];
        }

        return null;
    }

    /** @noinspection PhpUnusedPrivateMethodInspection */
    private function resolveError($val) {
        return array_key_exists(LoginType::ERROR_FIELD_NAME, $val) ? $val[LoginType::ERROR_FIELD_NAME] : null;
    }
}