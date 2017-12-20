<?php
/**
 * Created by PhpStorm.
 * User: fabian
 * Date: 26.09.17
 * Time: 09:48
 */

namespace App\Schema\Types\Query;


use App\Entity\Tasklist;
use App\Schema\Types;
use App\Security\TasklistVoter;
use Doctrine\Bundle\DoctrineBundle\Registry;
use GraphQL\Error\Error;
use GraphQL\Type\Definition\ObjectType;
use GraphQL\Type\Definition\ResolveInfo;
use Symfony\Bridge\Doctrine\RegistryInterface;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorage;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;
use Symfony\Component\Security\Core\Authorization\AuthorizationCheckerInterface;

class QueryType extends ObjectType
{
    /** @var AuthorizationCheckerInterface  */
    private $authChecker;
    /** @var RegistryInterface  */
    private $doctrine;
    /** @var TokenStorageInterface  */
    private $tokenStorage;

    public function __construct(AuthorizationCheckerInterface $authChecker, RegistryInterface $doctrine, TokenStorageInterface $tokenStorage)
    {
        $this->authChecker = $authChecker;
        $this->doctrine = $doctrine;
        $this->tokenStorage = $tokenStorage;

        $config = [
            'name' => 'Query',
            'fields' => [
                'hello' => Types::string(),
                'tasklists' => [
                    'type' => Types::listOf(Types::tasklist()),
                ],
                'tasklist' => [
                    'type' => Types::tasklist(),
                    'args' => [
                            'id' => Types::nonNull(Types::id())
                    ]
                ]
            ],
            'resolveField' => function ($val, $args, $context, ResolveInfo $info)
            {
                return $this->{$info->fieldName}($val, $args, $context, $info);
            }
        ];
        parent::__construct($config);
    }

    private function hello()
    {
        return "Your GraphQL endpoint is ready! Use GraphiQL to browse API.";
    }

    private function tasklists()
    {
        $user = $this->tokenStorage->getToken()->getUser();
        return $this->doctrine->getRepository(Tasklist::class)->findAllWithAccess($user);
    }

    private function tasklist($val, $args)
    {
        $id = $args['id'];
        $tasklist = $this->doctrine->getRepository(Tasklist::class)->find($id);

        if ($tasklist !== null && $this->authChecker->isGranted(TasklistVoter::ACCESS, $tasklist)) {
            return $tasklist;
        }

        throw new Error(
            sprintf(
                'No tasklist with id=%d found',
                $id
            )
        );
    }
}