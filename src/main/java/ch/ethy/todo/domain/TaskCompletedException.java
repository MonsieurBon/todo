package ch.ethy.todo.domain;

/** Raised when a change is asked of a task that is done. Reopening it is the way back. */
public class TaskCompletedException extends RuntimeException {
  public TaskCompletedException(String message) {
    super(message);
  }
}
