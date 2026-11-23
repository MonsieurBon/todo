package ch.ethy.todo.web;

import ch.ethy.todo.push.PushDevices;
import ch.ethy.todo.service.CurrentUserService;
import ch.ethy.todo.web.dto.Requests;
import ch.ethy.todo.web.dto.Responses;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/push")
public class PushController {

  private final PushDevices devices;
  private final CurrentUserService currentUser;

  public PushController(PushDevices devices, CurrentUserService currentUser) {
    this.devices = devices;
    this.currentUser = currentUser;
  }

  @GetMapping("/key")
  public Responses.PushKey pushKey() {
    return new Responses.PushKey(devices.publicKey().orElse(null));
  }

  /** Also how a device that registered before is sent its Critical Now again. */
  @PutMapping("/subscription")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void subscribeDevice(@Valid @RequestBody Requests.PushDevice device) {
    devices.register(currentUser.current(), device.endpoint(), device.p256dh(), device.auth());
  }
}
