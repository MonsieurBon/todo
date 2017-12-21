<?php

namespace App\Entity;

abstract class TaskType
{
    const CRITICAL_NOW = 'CRITICAL_NOW';
    const OPPORTUNITY_NOW = 'OPPORTUNITY_NOW';
    const OVER_THE_HORIZON = 'OVER_THE_HORIZON';

    /**
     * @return array
     */
    public static function values()
    {
        return [self::CRITICAL_NOW, self::OPPORTUNITY_NOW, self::OVER_THE_HORIZON];
    }
}
