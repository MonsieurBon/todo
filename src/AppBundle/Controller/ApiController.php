<?php

namespace AppBundle\Controller;

use AppBundle\Schema\LoginSchema;
use AppBundle\Schema\Schema;
use AppBundle\Service\GraphQLQueryExecutor;
use FOS\RestBundle\Controller\Annotations as Rest;
use Psr\Log\LoggerInterface;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Route;
use Symfony\Bundle\FrameworkBundle\Controller\Controller;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Security\Core\Encoder\UserPasswordEncoder;

/**
 * Class ApiController
 *
 * @Route("/api")
 *
 * @package AppBundle\Controller
 */
class ApiController extends Controller
{
    private static $DEFAULT_QUERY = '{hello}';

    /**
     * @Rest\Post("", defaults={"_format" = "json"}, options={"expose" = true})
     * @param Request $request
     * @param GraphQLQueryExecutor $executor
     * @param Schema $schema
     * @return array
     * @internal param Schema $schema
     * @internal param LoggerInterface $logger
     */
    public function indexAction(Request $request, GraphQLQueryExecutor $executor, Schema $schema)
    {
        $result = $executor->executeQuery(
            $request,
            $schema,
            self::$DEFAULT_QUERY
        );

        return $result->toArray();
    }

    /**
     * @param Request $request
     * @param GraphQLQueryExecutor $executor
     * @param LoginSchema $schema
     * @return array
     */
    public function loginAction(Request $request, GraphQLQueryExecutor $executor, LoginSchema $schema)
    {
        $result = $executor->executeQuery(
            $request,
            $schema,
            self::$DEFAULT_QUERY
        );

        return $result->toArray();
    }
}
