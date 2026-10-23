package ch.ethy.todo.domain;

/** Raised when a change is asked of a task that is done. Reopening it is the way back. */
public class TaskCompletedException extends TaskStateException {
  public TaskCompletedException(String message) {
    super("task_completed", message);
  }
}
