<?php

namespace App\Service;

use GraphQL\Executor\ExecutionResult;
use GraphQL\GraphQL;
use GraphQL\Type\Schema;
use Psr\Log\LoggerInterface;
use Symfony\Component\HttpFoundation\Request;

class GraphQLQueryExecutor
{
    const QUERY = 'query';
    const VARIABLES = 'variables';

    private $logger;

    public function __construct(LoggerInterface $logger)
    {
        $this->logger = $logger;
    }

    /**
     * @param Request $request
     * @param Schema  $schema
     * @param null    $defaultQuery
     *
     * @return ExecutionResult
     */
    public function executeQuery(Request $request, Schema $schema, $defaultQuery = null)
    {
        $schema->assertValid();
        $this->validateSchemaIfDebug($request, $schema);

        $query = $request->request->get(self::QUERY);
        $variables = $request->request->get(self::VARIABLES);

        $input = [
            self::QUERY => trim($query) === '' ? null : $query,
            self::VARIABLES => $variables === '' ? null : $variables
        ];

        if ($input[self::QUERY] === null && $defaultQuery !== null) {
            $input[self::QUERY] = $defaultQuery;
        }

        $result = GraphQL::executeQuery(
            $schema,
            $input[self::QUERY],
            null,
            null,
            (array) $input[self::VARIABLES]
        );

        if (!empty($result->errors)) {
            $this->logger->error('GraphQL request failed!');
            $this->logger->error('    Query: ' . $query);
            $this->logger->error('    Variables: ' . json_encode($variables));
            foreach ($result->errors as $error) {
                $this->logger->error('    Message:', ['error' => $error->getMessage()]);
            }
        }

        return $result;
    }

    /**
     * @param Request $request
     * @param Schema  $schema
     */
    private function validateSchemaIfDebug(Request $request, Schema $schema)
    {
        $debug_api = $request->query->get('debug_api');
        if ($debug_api === '1') {
            $schema->assertValid();
        }
    }
}
