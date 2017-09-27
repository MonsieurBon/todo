<?php

namespace AppBundle\Entity;

use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\ORM\Mapping as ORM;

/**
 * Tasklist
 *
 * @ORM\Table(name="task_list")
 * @ORM\Entity(repositoryClass="AppBundle\Repository\TasklistRepository")
 */
class Tasklist
{
    /**
     * @var int
     *
     * @ORM\Column(name="id", type="integer")
     * @ORM\Id
     * @ORM\GeneratedValue(strategy="AUTO")
     */
    private $id;

    /**
     * @var string
     *
     * @ORM\Column(name="name", type="string", length=255)
     */
    private $name;

    /**
     * @var ArrayCollection
     *
     * @ORM\OneToMany(targetEntity="Task", mappedBy="tasklist")
     */
    private $tasks;

    public function __construct()
    {
        $this->tasks = new ArrayCollection();
    }


    /**
     * Get id
     *
     * @return int
     */
    public function getId()
    {
        return $this->id;
    }

    /**
     * Set name
     *
     * @param string $name
     *
     * @return Tasklist
     */
    public function setName($name)
    {
        $this->name = $name;

        return $this;
    }

    /**
     * Get name
     *
     * @return string
     */
    public function getName()
    {
        return $this->name;
    }

    /**
     * @return ArrayCollection
     */
    public function getTasks()
    {
        return $this->tasks;
    }

    public function addTask(Task $task)
    {
        if (!$this->tasks->contains($task)) {
            $this->tasks->add($task);
            $task->setTasklist($this);
        }
    }

    public function removeTask(Task $task)
    {
        if ($this->tasks->contains($task)) {
            $this->tasks->remove($task);
            $task->setTasklist(null);
        }
    }

    public function removeAllTasks()
    {
        $tempTasks = $this->tasks;
        $this->tasks = new ArrayCollection();
        foreach ($tempTasks as $task) {
            $task->setTasklist(null);
        }
    }
}

