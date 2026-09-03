package ch.ethy.todo.web;

import ch.ethy.todo.service.NotFoundException;
import ch.ethy.todo.web.dto.Responses;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {

  /**
   * Both "no such list" and "not your list" arrive here. Answering 403 for the latter would confirm
   * the id exists, so they are deliberately indistinguishable from outside.
   */
  @ExceptionHandler(NotFoundException.class)
  public ResponseEntity<Responses.ApiError> notFound(NotFoundException e) {
    return ResponseEntity.status(HttpStatus.NOT_FOUND)
        .body(new Responses.ApiError("not_found", e.getMessage(), Map.of()));
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<Responses.ApiError> invalid(MethodArgumentNotValidException e) {
    Map<String, String> fields = new LinkedHashMap<>();
    e.getBindingResult()
        .getFieldErrors()
        .forEach(f -> fields.putIfAbsent(f.getField(), f.getDefaultMessage()));
    return ResponseEntity.badRequest()
        .body(new Responses.ApiError("validation_failed", "Request body is invalid", fields));
  }

  /** Domain invariants (a blank title, a deferral into the past) are client errors, not 500s. */
  @ExceptionHandler(IllegalArgumentException.class)
  public ResponseEntity<Responses.ApiError> illegal(IllegalArgumentException e) {
    return ResponseEntity.badRequest()
        .body(new Responses.ApiError("invalid_request", e.getMessage(), Map.of()));
  }
}
