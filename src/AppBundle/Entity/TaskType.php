<?php
/**
 * Created by PhpStorm.
 * User: fabian
 * Date: 26.09.17
 * Time: 10:34
 */

namespace AppBundle\Entity;


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
        return array(self::CRITICAL_NOW, self::OPPORTUNITY_NOW, self::OVER_THE_HORIZON);
    }
}