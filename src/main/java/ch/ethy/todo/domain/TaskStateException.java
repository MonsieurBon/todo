package ch.ethy.todo.domain;

/**
 * Raised when a task's state refuses a change the request itself could not be faulted for. The
 * reason names which refusal it is, because a client treats them differently.
 */
public class TaskStateException extends RuntimeException {

  private final String reason;

  public TaskStateException(String reason, String message) {
    super(message);
    this.reason = reason;
  }

  public String reason() {
    return reason;
  }
}
