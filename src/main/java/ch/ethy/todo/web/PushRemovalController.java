package ch.ethy.todo.web;

import ch.ethy.todo.push.PushDevices;
import ch.ethy.todo.web.dto.Requests;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Outside {@code /api}, which a token opens: this is called by a device that has signed out, often
 * from its service worker, which never has one.
 */
@RestController
public class PushRemovalController {

  private final PushDevices devices;

  public PushRemovalController(PushDevices devices) {
    this.devices = devices;
  }

  /** The same answer whatever was there, so it tells a caller nothing about other devices. */
  @PostMapping("/push/removal")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void removeSubscription(@Valid @RequestBody Requests.PushRemoval removal) {
    devices.remove(removal.endpoint(), removal.auth());
  }
}
