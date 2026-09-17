package ch.ethy.todo.service;

/** Raised when a resource does not exist <em>or</em> the caller may not see it. */
public class NotFoundException extends RuntimeException {
  public NotFoundException(String message) {
    super(message);
  }
}
