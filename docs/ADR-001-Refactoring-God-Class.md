# Context

In the legacy implementation of the subscription billing engine, the `LegacySubscriptionManager` served as an monolithic "God Class" that violated several fundamental software engineering principles. The legacy code interleaved multiple distinct responsibilities into a single procedural method:

1. **Direct Infrastructure Coupling**: The class directly established connections to the relational database using ambient environment variables (`new DatabaseConnection(process.env.DB_URL)`) and instantiated third-party HTTP clients (`new ThirdPartyPaymentClient(process.env.PAYMENT_API_KEY)`).
2. **Temporal Coupling**: The logic relied on non-deterministic system clock calls (`new Date()`). This made deterministic testing impossible without complex monkey-patching of the global runtime environment.
3. **I/O and Business Logic Interleaving**: Core domain rules—such as validating whether a subscription has already expired, calculating seasonal promotional discounts (such as the 10% December discount), and calculating the subsequent 1-year expiration window—were tightly coupled with raw SQL query execution and HTTP network communication.
4. **Untestability and Fragility**: Because high-level policy depended directly on low-level implementation details, writing isolated unit tests was impossible. Any attempt to verify simple business logic required spinning up a live PostgreSQL instance, populating live rows, mocking Stripe API endpoints at the network level, and artificially adjusting the operating system clock.

# Decision

To resolve these architectural flaws and establish an extensible, maintainable, and verifiable codebase, we adopted **Hexagonal Architecture (Ports and Adapters)** combined with **SOLID Object-Oriented Design Principles**:

1. **Dependency Inversion Principle (DIP)**:
   - High-level business rules (`SubscriptionBillingService`) no longer import or instantiate low-level infrastructure modules.
   - Core domain logic defines abstract interfaces (**Ports**) representing the external capabilities it requires:
     - `ISubscriptionRepository`: Contract for retrieving and updating subscription records.
     - `IUserRepository`: Contract for looking up customer billing identifiers.
     - `IPaymentGateway`: Contract for executing monetary charges.
     - `ITimeProvider`: Contract for retrieving deterministic timestamps.
   - The concrete infrastructure layer implements these contracts via **Adapters** (`PostgresSubscriptionRepository`, `PostgresUserRepository`, `MockPaymentGateway`, and `SystemTimeProvider`).

2. **Single Responsibility Principle (SRP)**:
   - `SubscriptionBillingService` has one single reason to change: modifications to domain billing policy (such as discount calculations or expiration date algorithms).
   - Adapters have single reasons to change: database driver updates, SQL optimizations, or payment provider API version migrations.
   - Controllers handle HTTP transport protocols, parameter extraction, and status code mapping.

3. **Constructor Dependency Injection**:
   - All external collaborators are supplied via the `SubscriptionBillingService` constructor. The domain layer has zero knowledge of Postgres, Stripe, or system clocks.

4. **Pure Domain Isolation**:
   - The `src/domain/` module contains zero imports of database libraries (e.g., `pg`), HTTP clients (e.g., `axios`, `fetch`), or web framework elements (e.g., `express`).

# Consequences

Adopting Hexagonal Architecture introduces clear trade-offs that have been deliberately evaluated:

### Positive Consequences
- **100% Deterministic Unit Testing**: The domain service is verified in total isolation using test doubles (mocks and stubs). Tests execute in milliseconds without external dependencies, network access, or database state.
- **Pluggability and Swappability**: Switching database vendors (e.g., from PostgreSQL to DynamoDB or MySQL) or payment gateways (e.g., from Stripe to Adyen or PayPal) requires writing a new adapter without altering a single line of business logic.
- **Architectural Clarity**: The boundaries between business rules, application orchestration, and infrastructure details are strictly enforced by the folder structure and TypeScript type system.
- **Time Determinism**: Temporal edge cases—such as leap years, time-zone transitions, and month-boundary discounts—can be exhaustively tested simply by providing fixed timestamps via a mock `ITimeProvider`.

### Trade-offs & Mitigations
- **Increased File Count and Indirection**: Introducing ports, adapters, and domain models requires more boilerplate and navigation than a single script. *Mitigation*: The structure is standardized across the codebase, making navigation predictable and scalable for enterprise teams.
- **Mapping Overhead**: Entities must be converted between raw database rows and domain models. *Mitigation*: Explicit mapping prevents database column changes from breaking core business logic.

# Code Smells Addressed

The refactoring systematically eliminated the primary code smells identified in the legacy implementation:

| Original Code Smell | Manifestation in Legacy Code | Architectural Solution |
| :--- | :--- | :--- |
| **God Class / Feature Envy** | `LegacySubscriptionManager` handled DB queries, payment HTTP calls, time inspection, and pricing rules. | Decomposed into dedicated domain models (`User`, `Subscription`), ports (`ISubscriptionRepository`, `IUserRepository`, `IPaymentGateway`, `ITimeProvider`), adapters (`Postgres*`, `MockPaymentGateway`), and an HTTP controller (`SubscriptionController`). |
| **Hidden Dependencies** | Directly called `new DatabaseConnection(process.env.DB_URL)` and `new ThirdPartyPaymentClient(...)` inside the method. | Enforced **Inversion of Control (IoC)** via explicit constructor injection in `SubscriptionBillingService`. |
| **Temporal Coupling** | Called native system clock `new Date()` within the rule engine, preventing isolated date simulation. | Extracted `ITimeProvider` port. In production, `SystemTimeProvider` returns `new Date()`; in tests, a deterministic mock supplies exact test dates. |
| **I/O Interleaving** | SQL queries and payment HTTP requests were interleaved between discount calculations and validation checks. | Domain service orchestrates calls across abstract ports; all I/O is isolated inside adapter boundaries. |
| **Leaky Abstractions** | Raw database rows and third-party response formats were assumed directly throughout the execution flow. | Standardized domain contracts return clean domain entities (`User`, `Subscription`) or primitives (`boolean`), shielding domain logic from infrastructure volatility. |
