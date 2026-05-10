---
name: to-infra-issues
description: Break an infrastructure plan, IaC spec, migration, or platform change into dependency-aware, apply-safe issues for an issue tracker. Use when converting Infrastructure as Code work into implementation tickets.
---

# To Infra Issues

Break an Infrastructure as Code plan into independently grabbable, dependency-aware issues that can be planned, reviewed, applied, verified, and rolled back safely.

Do **not** use software-style tracer bullets or vertical slices for IaC. Infrastructure work should be decomposed around resource dependencies, state boundaries, blast radius, rollout order, and operational safety.

The issue tracker and triage label vocabulary should have been provided to you — run `/setup-matt-pocock-skills` if not.

## Process

### 1. Gather context

Work from whatever is already in the conversation context. If the user passes an issue reference, URL, document, or file path as an argument, fetch/read it fully, including comments or linked decisions.

Clarify the target infrastructure goal:

- What business/platform capability is being enabled?
- Which environments are affected? (`dev`, `staging`, `prod`, shared services, DR, etc.)
- Which IaC tool is in use? Terraform/OpenTofu, Pulumi, CDK, CloudFormation, Kubernetes manifests, Helm, Ansible, etc.
- Which cloud/accounts/clusters/regions are in scope?
- Are there compliance, security, cost, availability, or change-window constraints?

### 2. Explore the infrastructure repo and runtime context

If you have not already explored the repo, do so before drafting issues. Look for:

- IaC tool conventions, modules/stacks/workspaces, environment layout, CI/CD pipelines
- Remote state backends, state locking, workspace/account boundaries
- Existing ADRs, `CONTEXT.md`, runbooks, architecture docs, diagrams, and naming/tagging conventions
- Provider versions, module versions, policy-as-code checks, linting, tests, and plan/apply workflows
- Secrets handling and required approvals

Issue titles and descriptions should use the project's domain vocabulary and respect ADRs in the area being changed.

### 3. Build an infrastructure dependency map

Before splitting work, identify the dependency graph and risk profile:

- Foundation dependencies: accounts/projects, networking, DNS zones, certificates, KMS/keys, identity, service principals
- Shared services: registries, buckets, databases, queues, monitoring, logging, policy controls
- Consumers: applications, workloads, cluster add-ons, service bindings, IAM attachments
- State operations: imports, moves, taints, removals, backend/workspace changes
- Migration operations: dual-write/dual-run, data copy, DNS cutover, traffic shifting, decommissioning
- Validation points: plan output, tests, policy checks, smoke checks, dashboards, alerts
- Rollback/backout options and irreversible steps

### 4. Draft infrastructure change units

Break the plan into **change units**, not vertical slices. A change unit is the smallest safe piece of infrastructure work that can be reviewed and applied with a clear blast radius.

Change units may be `HITL`, `AFK`, or `CONTROLLED APPLY`:

- `AFK`: can be implemented, tested, and opened as a PR without human interaction. It may include plan generation but should not require production credentials or destructive apply.
- `CONTROLLED APPLY`: implementation can be prepared by an agent, but applying requires a human/operator, credentials, maintenance window, or explicit approval.
- `HITL`: requires a human decision before implementation, such as architecture, cost, security, naming, account boundary, or migration strategy.

<infra-change-unit-rules>
- Decompose by dependency order, state boundary, and blast radius.
- Prefer small, apply-safe changes over broad module rewrites.
- Separate foundational resources from dependent resources.
- Separate refactors/state moves/imports from behavioral infrastructure changes.
- Separate high-risk or irreversible actions from low-risk preparatory work.
- Separate production rollout from lower-environment rollout when the risk or approval path differs.
- Each unit must define how to plan, validate, apply, verify, and roll back/back out.
- A completed unit should leave infrastructure in a coherent, supportable state.
- Do not create artificial tickets that each touch every layer; IaC work often must be horizontal and dependency-led.
</infra-change-unit-rules>

Common IaC issue shapes:

- Discover/import existing unmanaged resources into state
- Add or update reusable module inputs/outputs
- Create foundational resources in non-prod
- Roll out the same resource to prod after non-prod verification
- Introduce IAM/policy changes with least-privilege review
- Add observability, alarms, dashboards, or audit logging
- Add CI plan/policy checks before enabling apply
- Perform a state move or module refactor with no intended resource change
- Migrate traffic/data using staged cutover and rollback checkpoints
- Decommission old resources after verification and retention windows

### 5. Quiz the user

Present the proposed breakdown as a numbered list. For each change unit, show:

- **Title**: short descriptive name
- **Type**: HITL / AFK / CONTROLLED APPLY
- **Environment(s)**: affected environments/accounts/regions/clusters
- **Blocked by**: which other units must complete first
- **Blast radius**: low / medium / high, with one sentence explaining why
- **State impact**: none / import / move / remove / backend change / unknown
- **Apply risk**: no apply / additive / mutating / destructive / irreversible
- **Verification**: how completion will be proven

Ask the user:

- Does the dependency order match the real infrastructure constraints?
- Is the blast-radius split right, or should any unit be split/merged?
- Are production and non-production changes separated appropriately?
- Are state operations isolated enough?
- Are the correct units marked as HITL, AFK, and CONTROLLED APPLY?
- Are any approvals, change windows, security reviews, or cost reviews missing?

Iterate until the user approves the breakdown.

### 6. Publish the issues to the issue tracker

For each approved change unit, publish a new issue to the issue tracker. Use the issue body template below. These issues are considered ready for agents/operators, so publish them with the correct triage label unless instructed otherwise.

Publish issues in dependency order so you can reference real issue identifiers in the "Blocked by" field.

<issue-template>
## Parent

A reference to the parent issue on the issue tracker, if the source was an existing issue. Otherwise omit this section.

## Infrastructure change

A concise description of the infrastructure change unit. Describe the intended infrastructure state and why this unit is split this way. Include affected environments/accounts/regions/clusters.

Avoid brittle file-by-file instructions unless a specific state operation, module boundary, or generated artifact must be named precisely.

## Scope

- In scope:
  - Item 1
  - Item 2
- Out of scope:
  - Item 1

## Operational safety

- Blast radius: low / medium / high — explain briefly
- State impact: none / import / move / remove / backend change / unknown
- Apply risk: no apply / additive / mutating / destructive / irreversible
- Required approvals/change window: none / describe
- Rollback/backout plan: describe the safest known option, or say what must be decided before apply

## Implementation notes

Mention important IaC/tooling constraints, module boundaries, provider/version considerations, naming/tagging conventions, and secrets handling. Do not include credentials or secret values.

## Acceptance criteria

- [ ] IaC changes are implemented following project conventions
- [ ] Formatting, linting, validation, tests, and policy checks pass
- [ ] Plan output is reviewed and matches the expected resource changes
- [ ] Apply/runbook steps are documented if apply is not automatic
- [ ] Post-apply verification is documented and/or completed as appropriate
- [ ] Rollback/backout notes are documented

## Verification

List concrete checks: plan summary, policy checks, smoke tests, cloud console/API checks, Kubernetes health checks, logs/metrics/alerts, DNS/cert validation, cost estimate, etc.

## Blocked by

- A reference to the blocking ticket, if any

Or "None - can start immediately" if no blockers.
</issue-template>

Do NOT close or modify any parent issue unless explicitly instructed.
