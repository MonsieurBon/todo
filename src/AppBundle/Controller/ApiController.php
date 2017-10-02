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
     * @param LoggerInterface $logger
     * @return array
     */
    public function indexAction(Request $request, GraphQLQueryExecutor $executor, LoggerInterface $logger)
    {
        $schema = new Schema($this->getDoctrine());

        $result = $executor->executeQuery(
            $request,
            $schema,
            $logger,
            self::$DEFAULT_QUERY
        );

        return $result->toArray();
    }

    public function loginAction(Request $request, GraphQLQueryExecutor $executor, LoggerInterface $logger, UserPasswordEncoder $encoder)
    {
        $schema = new LoginSchema($this->container);

        $result = $executor->executeQuery(
            $request,
            $schema,
            $logger,
            self::$DEFAULT_QUERY
        );

        return $result->toArray();
    }
}
