# Refactored Subscription Billing Engine

An enterprise-grade, clean Hexagonal Architecture (Ports and Adapters) implementation of a subscription billing engine using SOLID principles and strict Dependency Injection.

---

## 🏛️ Architecture Overview

The system transitions from an untestable, procedural "God Class" (`LegacySubscriptionManager`) to an isolated, deterministic, and highly testable Ports and Adapters architecture.

```
                  ┌─────────────────────────────────────────┐
                  │               HTTP Client               │
                  └────────────────────┬────────────────────┘
                                       │ POST /api/renew
                                       ▼
                  ┌─────────────────────────────────────────┐
                  │       SubscriptionController            │
                  │   (Inversion of Control & Wiring)       │
                  └────────────────────┬────────────────────┘
                                       │ Injects Adapters
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       DOMAIN LAYER (Pure Business Logic)                    │
│                                                                             │
│                        SubscriptionBillingService                           │
│                                    │                                        │
│          ┌─────────────────────────┼─────────────────────────┐              │
│          ▼                         ▼                         ▼              │
│ ┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐    │
│ │ ISubscriptionRepo│      │  IUserRepository │      │ IPaymentGateway  │    │
│ │     (Port)       │      │      (Port)      │      │      (Port)      │    │
│ └────────┬─────────┘      └────────┬─────────┘      └────────┬─────────┘    │
│          │                         │                         │              │
│          │                 ┌───────┴────────┐                │              │
│          │                 │  ITimeProvider │                │              │
│          │                 │     (Port)     │                │              │
│          │                 └───────┬────────┘                │              │
└──────────┼─────────────────────────┼─────────────────────────┼──────────────┘
           │ Implements              │ Implements              │ Implements
┌──────────┼─────────────────────────┼─────────────────────────┼──────────────┐
│          ▼                         ▼                         ▼              │
│ ┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐    │
│ │ PostgresSubRepo  │      │ SystemTimeProvide│      │MockPaymentGateway│    │
│ │    (Adapter)     │      │    (Adapter)     │      │    (Adapter)     │    │
│ └────────┬─────────┘      └──────────────────┘      └──────────────────┘    │
│          │                                                                  │
│          ▼                                                                  │
│    PostgreSQL DB                                                            │
│                  INFRASTRUCTURE LAYER (Concrete Technology)                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 💎 SOLID Principles Applied

1. **Single Responsibility Principle (SRP)**:
   - `SubscriptionBillingService` handles *only* business rules (promotions, expiration calculation, renewal orchestration).
   - `PostgresSubscriptionRepository` & `PostgresUserRepository` handle *only* database queries and row mapping.
   - `MockPaymentGateway` handles *only* communication with external payment processors.
   - `SystemTimeProvider` handles *only* retrieving operating system time.
   - `SubscriptionController` handles *only* HTTP protocol parsing and status code mapping.

2. **Dependency Inversion Principle (DIP)**:
   - High-level domain service depends exclusively on abstract interfaces (`ISubscriptionRepository`, `IUserRepository`, `IPaymentGateway`, `ITimeProvider`).
   - Infrastructure adapters implement these domain ports.
   - No direct `new Database()` or `axios` calls exist in the domain layer.

3. **Open/Closed Principle (OCP)**:
   - New payment providers (e.g., Stripe, PayPal, Adyen) or storage backends (e.g., MongoDB, DynamoDB) can be added by implementing the ports without modifying any core domain logic.

4. **Interface Segregation Principle (ISP)**:
   - Small, focused ports define only the methods required for domain operations.

5. **Liskov Substitution Principle (LSP)**:
   - In-memory mock adapters can seamlessly substitute concrete Postgres or Stripe adapters in tests without unexpected behavior.

---

## 📂 Project Structure

```
subscription-billing-engine/
├── docs/
│   └── ADR-001-Refactoring-God-Class.md  # Architecture Decision Record
├── legacy/
│   └── LegacySubscriptionManager.ts       # Original God-Class (Preserved for review)
├── src/
│   ├── domain/                            # PURE DOMAIN (No DB, HTTP, or framework imports)
│   │   ├── models/                        # Domain entities
│   │   │   ├── User.ts
│   │   │   ├── Subscription.ts
│   │   │   └── index.ts
│   │   ├── ports/                         # Abstract interfaces (Contracts)
│   │   │   ├── ISubscriptionRepository.ts
│   │   │   ├── IUserRepository.ts
│   │   │   ├── IPaymentGateway.ts
│   │   │   ├── ITimeProvider.ts
│   │   │   └── index.ts
│   │   └── services/                      # Core business logic
│   │       └── SubscriptionBillingService.ts
│   └── infrastructure/                    # INFRASTRUCTURE (Concrete Technology)
│       ├── adapters/                      # Implementations of Domain Ports
│       │   ├── SystemTimeProvider.ts
│       │   ├── MockPaymentGateway.ts
│       │   ├── PostgresUserRepository.ts
│       │   ├── PostgresSubscriptionRepository.ts
│       │   └── index.ts
│       ├── database/                      # Connection pool & DDL scripts
│       │   ├── db.ts
│       │   └── init.sql
│       └── api/                           # HTTP Web Layer
│           ├── controllers/
│           │   └── SubscriptionController.ts
│           ├── app.ts                     # Express App & Interactive Dashboard
│           └── server.ts                  # App Entrypoint
├── tests/
│   ├── unit/                              # Isolated fast unit tests (Mocks & Stubs)
│   │   └── SubscriptionBillingService.test.ts
│   └── integration/                       # API Integration Tests
│       └── api.test.ts
├── docker-compose.yml                     # Multi-container orchestration (API + DB)
├── Dockerfile                             # Multi-stage production container build
├── .env.example                           # Documented environment variables
├── submission.json                        # Automated grader test mapping
├── tsconfig.json
└── package.json
```

---

## 🚀 Quickstart with Docker Compose

To boot both the PostgreSQL database and the API service with automatic schema migration and data seeding:

```bash
docker-compose up -d --build
```

### Healthcheck and Verification
- PostgreSQL includes automated healthcheck (`pg_isready -U postgres -d subscription_db`).
- The `api` service automatically waits for the database to become healthy before accepting traffic.
- Open your browser at **http://localhost:3000** to interact with the visual dashboard and test live renewals!

---

## 🧪 Running Tests

### Isolated Unit Tests (100% Coverage)
Executes isolated domain unit tests using mocks and stubs (no database or network required):
```bash
npm run test:unit
```

### Code Coverage Report
```bash
npm run test:coverage
```
*Current test suite achieves 100% statement, branch, function, and line coverage on `SubscriptionBillingService`.*

### Integration Tests
```bash
npm run test:integration
```

---

## 🔌 API Reference

### Renewal Endpoint

`POST /api/renew`

#### Request Body
```json
{
  "userId": "user-expired-001"
}
```

#### Successful Renewal Response (`200 OK`)
```json
{
  "success": true,
  "message": "Renewal successful"
}
```

#### Business Rule Failure Response (`400 Bad Request`)
```json
{
  "success": false,
  "message": "Subscription is not yet expired"
}
```

---

## 📋 Seeded Test Data (`submission.json`)

The database is pre-seeded on startup with the following test fixtures:

| Key | User ID | Subscription ID | Expiry Status | Expected POST /api/renew Result |
| :--- | :--- | :--- | :--- | :--- |
| `validUserId` | `user-expired-001` | `sub-expired-001` | EXPIRED (`2023-01-01`) | `200 OK` ("Renewal successful") |
| `unexpiredUserId` | `user-unexpired-002` | `sub-unexpired-002` | UNEXPIRED (`2099-12-31`) | `400 Bad Request` ("Subscription is not yet expired") |
| `nonExistentUserId` | `user-nonexistent-999`| N/A | Does not exist | `400 Bad Request` ("User not found") |
