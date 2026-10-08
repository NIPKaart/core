---
paths:
  - '**'
---

# Planning and repository pre-flight

Treat the repository as the source of truth for current behavior. Conversation context, issue descriptions and documentation provide intent, but they can be stale.

Before proposing implementation work, creating an issue/epic, or changing architecture:

1. Inspect the current implementation in the relevant routes, controllers/actions, models, migrations, policies, tests and UI.
2. Search existing issues/PRs and repository docs/ADRs for overlapping or already completed work.
3. Separate observed current state from desired behavior. Do not present a feature as missing until the code proves it is missing.
4. Read the relevant ADRs and domain contracts before proposing a new architectural boundary or domain concept.
5. When docs and implementation disagree, identify the drift explicitly. Do not silently choose the documentation or rewrite an accepted decision to match implementation.
6. Keep modernization/tooling work separate from product behavior unless the issue explicitly combines them.
7. Treat Laravel's starter kit and DDS Platform as references, not manifests to copy. NIPKaart's accepted ADRs, domain contracts and current requirements are authoritative.
8. Prefer a small, reviewable scope. State what is intentionally out of scope when adjacent work could otherwise be pulled in.

For GitHub planning, use real GitHub relationships when the task requires them. A `Parent: #123` line or a related-issue link is useful context but is not a GitHub sub-issue relationship. Verify that the requested relationship was actually created; if the available tooling cannot create it, say so instead of implying it exists.

A useful issue should normally make the evidence visible: goal, relevant current state, scope/changes, out of scope where needed, acceptance criteria, and dependencies/parent relationships. Do not add sections mechanically when they add no information.
