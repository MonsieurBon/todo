<?php
/**
 * Created by PhpStorm.
 * User: fabian
 * Date: 05.10.17
 * Time: 06:42
 */

namespace Tests\AppBundle\Controller;


use Tests\AppBundle\DB\DbTestCase;

class GraphQLTestCase extends DbTestCase
{
    protected static function sendApiQuery($query, $token = null, $urlParam = array()) {
        $headers = array('CONTENT_TYPE' => 'application/json');
        if ($token !== null) {
            $headers['HTTP_X_AUTH_TOKEN'] = $token;
        }

        $url = '/api';

        if (count($urlParam) > 0) {
            $url .= '?';
            $param = array_map(function($k, $v) {
                return $k . '=' . $v;
            }, array_keys($urlParam), $urlParam);
            $url .= implode('&', $param);
        }

        $client = static::createClient();
        $client->request(
            'POST',
            $url,
            array(),
            array(),
            $headers,
            $query
        );
        return $client;
    }
}