package ch.ethy.todo.spike;

import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Phase 0 spike only — proves the resource server validates issuer, audience and scope end to end.
 * Delete once the real controllers land in Phase 2.
 */
@RestController
@RequestMapping("/api/spike")
public class SpikeController {

  @GetMapping("/whoami")
  public Map<String, Object> whoami(@AuthenticationPrincipal Jwt jwt) {
    return Map.of(
        "subject", String.valueOf(jwt.getSubject()),
        "audience", jwt.getAudience(),
        "scope", String.valueOf(jwt.getClaimAsString("scope")));
  }

  /** Requires todo:write, so a capture-only token must be refused here. */
  @GetMapping("/needs-write")
  @PreAuthorize("hasAuthority('SCOPE_todo:write')")
  public Map<String, Object> needsWrite(@AuthenticationPrincipal Jwt jwt) {
    return Map.of("ok", true, "subject", jwt.getSubject());
  }
}
