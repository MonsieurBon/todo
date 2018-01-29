<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

/**
 * Task
 *
 * @ORM\Table(name="task")
 * @ORM\Entity(repositoryClass="App\Repository\TaskRepository")
 */
class Task
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
     * @ORM\Column(name="title", type="string", length=255)
     */
    private $title;

    /**
     * @var string
     *
     * @ORM\Column(name="description", type="text", nullable=true)
     */
    private $description;

    /**
     * @var \DateTime
     *
     * @ORM\Column(name="startdate", type="date")
     */
    private $startdate;

    /**
     * @var \DateTime
     *
     * @ORM\Column(name="duedate", type="date", nullable=true)
     */
    private $duedate;

    /**
     * @var string
     *
     * @ORM\Column(name="state", type="string", length=255)
     */
    private $state;

    /**
     * @var string
     *
     * @ORM\Column(name="type", type="string", length=255)
     */
    private $type;

    /**
     * @var Tasklist
     *
     * @ORM\ManyToOne(targetEntity="Tasklist", inversedBy="tasks")
     * @ORM\JoinColumn(name="tasklist_id", referencedColumnName="id", onDelete="CASCADE")
     */
    private $tasklist;

    public function __construct()
    {
        $this->state = TaskState::TODO;
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
     * Set title
     *
     * @param string $title
     *
     * @return Task
     */
    public function setTitle($title)
    {
        $this->title = $title;

        return $this;
    }

    /**
     * Get title
     *
     * @return string
     */
    public function getTitle()
    {
        return $this->title;
    }

    /**
     * Set description
     *
     * @param string $description
     *
     * @return Task
     */
    public function setDescription($description)
    {
        $this->description = $description;

        return $this;
    }

    /**
     * Get description
     *
     * @return string
     */
    public function getDescription()
    {
        return $this->description;
    }

    /**
     * Set startdate
     *
     * @param \DateTime $startdate
     *
     * @return Task
     */
    public function setStartDate($startdate)
    {
        $this->startdate = $startdate;

        return $this;
    }

    /**
     * Get startdate
     *
     * @return \DateTime
     */
    public function getStartDate()
    {
        return $this->startdate;
    }

    /**
     * Set duedate
     *
     * @param \DateTime $duedate
     *
     * @return Task
     */
    public function setDueDate($duedate)
    {
        $this->duedate = $duedate;

        return $this;
    }

    /**
     * Get duedate
     *
     * @return \DateTime
     */
    public function getDueDate()
    {
        return $this->duedate;
    }

    /**
     * Set state
     *
     * @param string $state
     *
     * @return Task
     */
    public function setState($state)
    {
        if (!in_array($state, TaskState::values())) {
            throw new \UnexpectedValueException('Invalid value for TaskState');
        }

        $this->state = $state;

        return $this;
    }

    /**
     * Get state
     *
     * @return string
     */
    public function getState()
    {
        return $this->state;
    }

    /**
     * Set type
     *
     * @param string $type
     *
     * @return Task
     */
    public function setType($type)
    {
        if (!in_array($type, TaskType::values())) {
            throw new \UnexpectedValueException('Invalid value for TaskType');
        }

        $this->type = $type;

        return $this;
    }

    /**
     * Get type
     *
     * @return string
     */
    public function getType()
    {
        return $this->type;
    }

    /**
     * @return Tasklist
     */
    public function getTasklist()
    {
        return $this->tasklist;
    }

    /**
     * @param Tasklist $tasklist
     *
     * @return Task
     */
    public function setTasklist($tasklist)
    {
        if ($this->tasklist !== $tasklist) {
            if ($this->tasklist !== null) {
                $this->tasklist->removeTask($this);
            }

            $this->tasklist = $tasklist;

            if ($this->tasklist !== null) {
                $this->tasklist->addTask($this);
            }
        }

        return $this;
    }
}
