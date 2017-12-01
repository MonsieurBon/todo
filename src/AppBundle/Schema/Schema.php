<?php
/**
 * Created by PhpStorm.
 * User: fabian
 * Date: 28.09.17
 * Time: 22:12
 */

namespace AppBundle\Schema;

use Doctrine\Bundle\DoctrineBundle\Registry;
use GraphQL\Type\Schema as GraphQLSchema;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorage;
use Symfony\Component\Security\Core\Authorization\AuthorizationCheckerInterface;

class Schema extends GraphQLSchema
{
    const DESCRIPTION_FIELD_NAME = 'description';
    const DUEDATE_FIELD_NAME = 'duedate';
    const STARTDATE_FIELD_NAME = 'startdate';
    const TASK_ID_FIELD_NAME = 'task_id';
    const TASKLIST_ID_FIELD_NAME = 'tasklist_id';
    const TASKLIST_NAME_FIELD_NAME = 'name';
    const TITLE_FIELD_NAME = 'title';
    const TOKEN_FIELD_NAME = 'token';
    const TYPE_FIELD_NAME = 'type';
    const USER_ID_FIELD_NAME = 'user_id';

    public function __construct(AuthorizationCheckerInterface $authChecker, Registry $doctrine, TokenStorage $tokenStorage)
    {
        Types::clear();

        $config = [
            'query' => Types::query($authChecker, $doctrine, $tokenStorage),
            'mutation' => Types::mutation($authChecker, $doctrine, $tokenStorage)
        ];
        parent::__construct($config);
    }
}