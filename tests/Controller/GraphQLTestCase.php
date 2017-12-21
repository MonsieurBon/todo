<?php

namespace App\Tests\Controller;

use App\Tests\DB\DbTestCase;

class GraphQLTestCase extends DbTestCase
{
    protected static function sendApiQuery($query, $token = null, $urlParam = [])
    {
        $headers = ['CONTENT_TYPE' => 'application/json'];
        if ($token !== null) {
            $headers['HTTP_X_AUTH_TOKEN'] = $token;
        }

        $url = '/api';

        if (count($urlParam) > 0) {
            $url .= '?';
            $param = array_map(function ($k, $v) {
                return $k . '=' . $v;
            }, array_keys($urlParam), $urlParam);
            $url .= implode('&', $param);
        }

        $client = static::createClient();
        $client->request(
            'POST',
            $url,
            [],
            [],
            $headers,
            $query
        );

        return $client;
    }
}
