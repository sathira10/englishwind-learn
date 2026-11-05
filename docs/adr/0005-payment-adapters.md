# 0005: Payment providers are adapters over one order and grant model

6 November 2026. Accepted.

## Context

Launch sells by bank transfer with Amma approving. Lemon Squeezy follows, then PayHere. Live
class students get the Blueprint at a lower price or free.

## Decision

Orders and grants are the model. Each provider is an adapter that turns its events into calls to
the same order functions in `src/domain/`: bank transfer (staff approval), Lemon Squeezy (signed
webhook), PayHere (later). Approving or confirming an order is idempotent and creates exactly
one grant. Offers carry the price, including class-linked prices and no-charge grants that staff
approve.

## Consequences

- Adding a provider doesn't change the student app or how Amma works.
- Webhook events are deduplicated by provider event ID.
- Refunds revoke the one grant the order created.
