<?php

namespace App\Schema\Types;

use App\Entity\Tasklist;
use App\Schema\Types;
use Doctrine\Common\Collections\Criteria;
use GraphQL\Type\Definition\ObjectType;
use GraphQL\Type\Definition\ResolveInfo;

class TasklistType extends ObjectType
{
    public function __construct()
    {
        $config = [
            'name' => 'Tasklist',
            'fields' => function () {
                return [
                    'id' => Types::id(),
                    'name' => Types::string(),
                    'slug' => Types::string(),
                    'tasks' => Types::listOf(Types::task())
                ];
            },
            'resolveField' => function ($value, $args, $context, ResolveInfo $info) {
                $method = 'resolve' . ucfirst($info->fieldName);
                if (method_exists($this, $method)) {
                    return $this->{$method}($value, $args, $context, $info);
                } else {
                    $getter = 'get' . ucfirst($info->fieldName);

                    return $value->{$getter}();
                }
            }
        ];
        parent::__construct($config);
    }

    /** @noinspection PhpUnusedPrivateMethodInspection */
    private function resolveTasks(Tasklist $value)
    {
        $today = new \DateTime();
        $criteria = Criteria::create()
            ->where(Criteria::expr()->lte('startdate', $today))
            ->orderBy(['startdate' => Criteria::DESC]);

        return $value->getTasks()->matching($criteria);
    }
}
