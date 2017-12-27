<?php

namespace App\Schema;

use App\Schema\Types\DateType;
use App\Schema\Types\Mutation\DestroyTokenType;
use App\Schema\Types\Mutation\LoginType;
use App\Schema\Types\Mutation\MutationType;
use App\Schema\Types\Mutation\Task\AddTaskType;
use App\Schema\Types\Mutation\Task\DeleteTaskType;
use App\Schema\Types\Mutation\Task\EditTaskType;
use App\Schema\Types\Mutation\Tasklist\CreateTasklistType;
use App\Schema\Types\Mutation\Tasklist\DeleteTasklistType;
use App\Schema\Types\Mutation\Tasklist\EditTasklistType;
use App\Schema\Types\Mutation\Tasklist\ShareTasklistType;
use App\Schema\Types\Query\QueryType;
use App\Schema\Types\Query\TokenValidityType;
use App\Schema\Types\TasklistType;
use App\Schema\Types\TaskType;
use App\Schema\Types\TaskTypeEnum;
use GraphQL\Type\Definition\BooleanType;
use GraphQL\Type\Definition\IDType;
use GraphQL\Type\Definition\ListOfType;
use GraphQL\Type\Definition\NonNull;
use GraphQL\Type\Definition\StringType;
use GraphQL\Type\Definition\Type;
use Symfony\Bridge\Doctrine\RegistryInterface;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;
use Symfony\Component\Security\Core\Authorization\AuthorizationCheckerInterface;

class Types
{
    private static $addTask;
    private static $createTasklist;
    private static $date;
    private static $deleteTask;
    private static $deleteTasklist;
    private static $destroyToken;
    private static $editTask;
    private static $editTasklist;
    private static $login;
    private static $mutation;
    private static $query;
    private static $shareTasklist;
    private static $task;
    private static $tasklist;
    private static $taskTypeEnum;
    private static $tokenValidity;

    public static function addTask(AuthorizationCheckerInterface $authChecker, RegistryInterface $doctrine)
    {
        return self::$addTask ?: (self::$addTask = new AddTaskType($authChecker, $doctrine));
    }

    public static function createTasklist(RegistryInterface $doctrine, TokenStorageInterface $tokenStorage)
    {
        return self::$createTasklist ?: (self::$createTasklist = new CreateTasklistType($doctrine, $tokenStorage));
    }

    public static function date()
    {
        return self::$date ?: (self::$date = new DateType());
    }

    public static function deleteTask(AuthorizationCheckerInterface $authChecker, RegistryInterface $doctrine)
    {
        return self::$deleteTask ?: (self::$deleteTask = new DeleteTaskType($authChecker, $doctrine));
    }

    public static function deleteTasklist(AuthorizationCheckerInterface $authChecker, RegistryInterface $doctrine, TokenStorageInterface $tokenStorage)
    {
        return self::$deleteTasklist ?: (self::$deleteTasklist = new DeleteTasklistType($authChecker, $doctrine, $tokenStorage));
    }

    public static function destroyToken(RegistryInterface $doctrine, TokenStorageInterface $tokenStorage)
    {
        return self::$destroyToken ?: (self::$destroyToken = new DestroyTokenType($doctrine, $tokenStorage));
    }

    public static function editTask(AuthorizationCheckerInterface $authChecker, RegistryInterface $doctrine)
    {
        return self::$editTask ?: (self::$editTask = new EditTaskType($authChecker, $doctrine));
    }

    public static function editTasklist(AuthorizationCheckerInterface $authChecker, RegistryInterface $doctrine)
    {
        return self::$editTasklist ?: (self::$editTasklist = new EditTasklistType($authChecker, $doctrine));
    }

    public static function login(ContainerInterface $container)
    {
        return self::$login ?: (self::$login = new LoginType($container));
    }

    public static function mutation(AuthorizationCheckerInterface $authChecker, RegistryInterface $doctrine, TokenStorageInterface $tokenInterface)
    {
        return self::$mutation ?: (self::$mutation = new MutationType($authChecker, $doctrine, $tokenInterface));
    }

    public static function query(AuthorizationCheckerInterface $authChecker, $doctrine, TokenStorageInterface $tokenStorage)
    {
        return self::$query ?: (self::$query = new QueryType($authChecker, $doctrine, $tokenStorage));
    }

    public static function shareTasklist(AuthorizationCheckerInterface $authChecker, RegistryInterface $doctrine)
    {
        return self::$shareTasklist ?: (self::$shareTasklist = new ShareTasklistType($authChecker, $doctrine));
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
     *
     * @return ListOfType
     */
    public static function listOf($type)
    {
        return new ListOfType($type);
    }

    /**
     * @param $type
     *
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
        self::$createTasklist = null;
        self::$deleteTask = null;
        self::$deleteTasklist = null;
        self::$destroyToken = null;
        self::$login = null;
        self::$mutation = null;
        self::$query = null;
        self::$shareTasklist = null;
    }
}
