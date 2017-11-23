<?php

namespace AppBundle\Schema;

use AppBundle\Schema\Types\DateType;
use AppBundle\Schema\Types\Mutation\DeleteTaskType;
use AppBundle\Schema\Types\Mutation\DestroyTokenType;
use AppBundle\Schema\Types\Mutation\LoginType;
use AppBundle\Schema\Types\Mutation\MutationType;
use AppBundle\Schema\Types\Mutation\Task\AddTaskType;
use AppBundle\Schema\Types\Query\QueryType;
use AppBundle\Schema\Types\Query\TokenValidityType;
use AppBundle\Schema\Types\TasklistType;
use AppBundle\Schema\Types\TaskType;
use AppBundle\Schema\Types\TaskTypeEnum;
use Doctrine\Bundle\DoctrineBundle\Registry;
use GraphQL\Type\Definition\BooleanType;
use GraphQL\Type\Definition\IDType;
use GraphQL\Type\Definition\ListOfType;
use GraphQL\Type\Definition\NonNull;
use GraphQL\Type\Definition\StringType;
use GraphQL\Type\Definition\Type;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorage;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\AuthorizationCheckerInterface;

class Types
{
    private static $addTask;
    private static $date;
    private static $deleteTask;
    private static $destroyToken;
    private static $login;
    private static $mutation;
    private static $query;
    private static $task;
    private static $tasklist;
    private static $taskTypeEnum;
    private static $tokenValidity;

    public static function addTask(AuthorizationCheckerInterface $authChecker, Registry $doctrine)
    {
        return self::$addTask ?: (self::$addTask = new AddTaskType($authChecker, $doctrine));
    }

    public static function date()
    {
        return self::$date ?: (self::$date = new DateType());
    }

    public static function deleteTask()
    {
        return self::$deleteTask ?: (self::$deleteTask = new DeleteTaskType());
    }

    public static function destroyToken(Registry $doctrine, TokenStorage $tokenStorage)
    {
        return self::$destroyToken ?: (self::$destroyToken = new DestroyTokenType($doctrine, $tokenStorage));
    }

    public static function login(ContainerInterface $container)
    {
        return self::$login ?: (self::$login = new LoginType($container));
    }

    public static function mutation(AuthorizationCheckerInterface $authChecker, Registry $doctrine, TokenStorage $tokenInterface)
    {
        return self::$mutation ?: (self::$mutation = new MutationType($authChecker, $doctrine, $tokenInterface));
    }

    public static function query(AuthorizationCheckerInterface $authChecker, $doctrine, TokenStorage $tokenStorage)
    {
        return self::$query ?: (self::$query = new QueryType($authChecker, $doctrine, $tokenStorage));
    }

    public static function task()
    {
        return self::$task ?: (self::$task = new TaskType());
    }

    public static function tasklist()
    {
        return self::$tasklist ?: (self::$tasklist = new TasklistType());
    }

    public static function taskTypeEnum()
    {
        return self::$taskTypeEnum ?: (self::$taskTypeEnum = new TaskTypeEnum());
    }

    public static function tokenValidity()
    {
        return self::$tokenValidity ?: (self::$tokenValidity = new TokenValidityType());
    }

    /**
     * @return BooleanType
     */
    public static function boolean()
    {
        return Type::boolean();
    }

    /**
     * @return IDType
     */
    public static function id()
    {
        return Type::id();
    }

    /**
     * @param $type
     * @return ListOfType
     */
    public static function listOf($type)
    {
        return new ListOfType($type);
    }

    /**
     * @param $type
     * @return NonNull
     */
    public static function nonNull($type)
    {
        return new NonNull($type);
    }

    /**
     * @return StringType
     */
    public static function string()
    {
        return Type::string();
    }

    public static function clear()
    {
        self::$addTask = null;
        self::$destroyToken = null;
        self::$login = null;
        self::$mutation = null;
        self::$query = null;
    }
}