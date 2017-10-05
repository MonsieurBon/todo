<?php
/**
 * Created by PhpStorm.
 * User: fabian
 * Date: 05.10.17
 * Time: 06:42
 */

namespace tests\AppBundle\Controller;

use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

class GraphQLTestCase extends WebTestCase
{
    protected static function sendApiQuery($query, $token = null) {
        $headers = array('CONTENT_TYPE' => 'application/json');
        if ($token !== null) {
            $headers['HTTP_X_AUTH_TOKEN'] = $token;
        }

        $client = static::createClient();
        $client->request(
            'POST',
            '/api',
            array(),
            array(),
            $headers,
            $query);
        return $client;
    }
}