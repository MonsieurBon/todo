<?php

namespace App\Tests\Base;

use Doctrine\Common\DataFixtures\DependentFixtureInterface;
use Doctrine\Common\DataFixtures\ProxyReferenceRepository;
use Doctrine\ORM\EntityManager;
use Symfony\Bridge\Doctrine\ManagerRegistry;
use Symfony\Bundle\DoctrineFixturesBundle\Common\DataFixtures\Loader;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase as BaseWebTestCase;
use Symfony\Component\DependencyInjection\ContainerInterface;

abstract class WebTestCase extends BaseWebTestCase
{
    /**
     * @var array
     */
    private $excludedDoctrineTables = [];

    protected function getContainer()
    {
        return static::createClient()->getContainer();
    }

    protected function loadFixtures(array $classNames, $omName = null, $registryName = 'doctrine', $purgeMode = null)
    {
        $container = $this->getContainer();
        /** @var ManagerRegistry $registry */
        $registry = $container->get($registryName);
        /** @var EntityManager $om */
        $om = $registry->getManager($omName);
        $type = $registry->getName();

        $executorClass = $type === 'PHPCR' && class_exists('Doctrine\\Bundle\\PHPCRBundle\\DataFixtures\\PHPCRExecutor')
            ? 'Doctrine\\Bundle\\PHPCRBundle\\DataFixtures\\PHPCRExecutor'
            : 'Doctrine\\Common\\DataFixtures\\Executor\\' . $type . 'Executor';
        $referenceRepository = new ProxyReferenceRepository($om);
        $cacheDriver = $om->getMetadataFactory()->getCacheDriver();

        if ($cacheDriver) {
            $cacheDriver->deleteAll();
        }

        $purgerClass = 'Doctrine\\Common\\DataFixtures\\Purger\\' . $type . 'Purger';

        $purger = new $purgerClass(null, $this->excludedDoctrineTables);

        if ($purgeMode !== null) {
            $purger->setPurgeMode($purgeMode);
        }

        $executor = new $executorClass($om, $purger);

        $executor->setReferenceRepository($referenceRepository);
        $executor->purge();

        $loader = $this->getFixtureLoader($container, $classNames);

        $executor->execute($loader->getFixtures(), true);

        return $executor;
    }

    /**
     * Retrieve Doctrine DataFixtures loader.
     *
     * @param ContainerInterface $container
     * @param array              $classNames
     *
     * @return Loader
     */
    protected function getFixtureLoader(ContainerInterface $container, array $classNames)
    {
        $loaderClass = class_exists('Symfony\Bridge\Doctrine\DataFixtures\ContainerAwareLoader')
            ? 'Symfony\Bridge\Doctrine\DataFixtures\ContainerAwareLoader'
            : (class_exists('Doctrine\Bundle\FixturesBundle\Common\DataFixtures\Loader')
                // This class is not available during tests.
                // @codeCoverageIgnoreStart
                ? 'Doctrine\Bundle\FixturesBundle\Common\DataFixtures\Loader'
                // @codeCoverageIgnoreEnd
                : 'Symfony\Bundle\DoctrineFixturesBundle\Common\DataFixtures\Loader');

        $loader = new $loaderClass($container);

        foreach ($classNames as $className) {
            $this->loadFixtureClass($loader, $className);
        }

        return $loader;
    }

    /**
     * Load a data fixture class.
     *
     * @param Loader $loader
     * @param string $className
     */
    protected function loadFixtureClass($loader, $className)
    {
        $fixture = null;

        if ($this->getContainer()->has($className)) {
            $fixture = $this->getContainer()->get($className);
        } else {
            $fixture = new $className();
        }

        if ($loader->hasFixture($fixture)) {
            unset($fixture);

            return;
        }

        $loader->addFixture($fixture);

        if ($fixture instanceof DependentFixtureInterface) {
            foreach ($fixture->getDependencies() as $dependency) {
                $this->loadFixtureClass($loader, $dependency);
            }
        }
    }

    /**
     * @param array $excludedDoctrineTables
     */
    public function setExcludedDoctrineTables($excludedDoctrineTables)
    {
        $this->excludedDoctrineTables = $excludedDoctrineTables;
    }
}
