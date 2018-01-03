<?php

namespace App\Entity;

abstract class TaskState
{
    const TODO = 'TODO';
    const DONE = 'DONE';

    /**
     * @return array
     */
    public static function values()
    {
        return [self::TODO, self::DONE];
    }
}
