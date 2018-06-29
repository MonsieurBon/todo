<?php

namespace App\Schema\Types;

use App\Entity\Tasklist;
use App\Entity\TaskState;
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
            'fields' => [
                'id' => Types::int(),
                'name' => Types::string(),
                'slug' => Types::string(),
                'tasks' => [
                    'type' => Types::listOf(Types::task()),
                    'args' => [
                        'showDone' => [
                            'type' => Types::boolean(),
                            'defaultValue' => false
                        ],
                        'showFuture' => [
                            'type' => Types::boolean(),
                            'defaultValue' => false
                        ]
                    ]
                ]
            ],
            'resolveField' => function ($tasklist, $args, $context, ResolveInfo $info) {
                $method = 'resolve' . ucfirst($info->fieldName);
                if (method_exists($this, $method)) {
                    return $this->{$method}($tasklist, $args, $context, $info);
                } else {
                    $getter = 'get' . ucfirst($info->fieldName);

                    return $tasklist->{$getter}();
                }
            }
        ];
        parent::__construct($config);
    }

    /** @noinspection PhpUnusedPrivateMethodInspection */
    private function resolveTasks(Tasklist $tasklist, $args)
    {
        $showDone = $args['showDone'];
        $showFuture = $args['showFuture'];
        $today = new \DateTime();

        $criteria = Criteria::create();

        if (!$showDone) {
            $criteria = $criteria->where(Criteria::expr()->eq('state', TaskState::TODO));
        }

        if (!$showFuture) {
            $criteria = $criteria->andWhere(Criteria::expr()->lte('startdate', $today));
        }

        return $tasklist->getTasks()->matching($criteria);
    }
}
