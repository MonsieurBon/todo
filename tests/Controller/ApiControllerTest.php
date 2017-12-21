<?php

namespace App\Tests\Controller;

class ApiControllerTest extends GraphQLTestCase
{
    public function testRedirectionForGet()
    {
        $client = static::createClient();
        $crawler = $client->request('GET', '/api');
        $response = $client->getResponse();

        $this->assertEquals(301, $response->getStatusCode());
        $this->assertEquals('http://localhost/', $response->headers->get('location'));
    }

    public function testPostWithNoQuery()
    {
        $client = static::createClient();
        $crawler = $client->request('POST', '/api');
        $response = $client->getResponse();

        $this->assertEquals(200, $response->getStatusCode());
        $this->assertEquals(
            '{"data":{"hello":"Your GraphQL endpoint is ready! Please log in to see the full API."}}',
            $response->getContent()
        );
    }

    public function testLogin()
    {
        $query = '{"query":"mutation{\n  createToken(username: \"foo\", password: \"test\"){\n    error\n    token\n  }\n}","variables":null}';
        $client = static::sendApiQuery($query);
        $response = $client->getResponse();
        $content = $response->getContent();
        $json = json_decode($content);

        $this->assertEquals(200, $response->getStatusCode());
        $this->assertNotNull($json->data->createToken->token);
        $this->assertFalse(property_exists($json->data->createToken, 'error'));
    }

    public function testLoginWithWrongPassword()
    {
        $query = '{"query":"mutation{\n  createToken(username: \"foo\", password: \"test123\"){\n    error\n    token\n  }\n}","variables":null}';
        $client = static::sendApiQuery($query);
        $response = $client->getResponse();
        $content = $response->getContent();
        $json = json_decode($content);

        $this->assertEquals(200, $response->getStatusCode());
        $this->assertFalse(property_exists($json->data->createToken, 'token'));
        $this->assertEquals('Invalid username or password', $json->data->createToken->error);
    }

    public function testLoginWithInvalidUser()
    {
        $query = '{"query":"mutation{\n  createToken(username: \"invalid\", password: \"test\"){\n    error\n    token\n  }\n}","variables":null}';
        $client = static::sendApiQuery($query);
        $response = $client->getResponse();
        $content = $response->getContent();
        $json = json_decode($content);

        $this->assertEquals(200, $response->getStatusCode());
        $this->assertFalse(property_exists($json->data->createToken, 'token'));
        $this->assertEquals('Invalid username or password', $json->data->createToken->error);
    }

    public function testAuthenticationWithCorrectCredentials()
    {
        $query = '{"query":"mutation{\n  createToken(username: \"foo\", password: \"test\"){\n    error\n    token\n  }\n}","variables":null}';
        $client = static::sendApiQuery($query);
        $response = $client->getResponse();
        $content = $response->getContent();
        $json = json_decode($content);

        $token = $json->data->createToken->token;

        $client = static::sendApiQuery('', $token);
        $response = $client->getResponse();

        $this->assertEquals(200, $response->getStatusCode());
        $this->assertEquals(
            '{"data":{"hello":"Your GraphQL endpoint is ready! Use GraphiQL to browse API."}}',
            $response->getContent()
        );
    }
}
