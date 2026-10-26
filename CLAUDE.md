# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

See also @AGENTS.md (issue templates, security reporting) and `CONTRIBUTING.md`.

Architecture maps live in docs/diagrams/**/*.json (Archify sources; the .html next to each is the rendered view).
Start from docs/diagrams/README.md: it indexes architecture/, structure/, features/ and one class-diagram/<module>.class.json per module.
Before searching the codebase, read the relevant diagram JSON to locate modules and source references,
then open only those files. If the diagram's revision differs from HEAD, verify paths before relying on them.

## Toolchain

- Always use the Maven wrapper `./mvnw`, never system `mvn` (Spotless goals in particular fail with system Maven).
- JDK 17, 21 or 25 (compiler release is 17; newer JDKs are unsupported).
- Node.js 24+ and PNPM (via `corepack enable`) for anything under `js/`.

## Commands

Full builds/test runs take hours — always scope to the module you touched with `-pl <module> -am`.

```bash
# Build everything without tests
./mvnw clean install -DskipTests

# Build only the server distribution (zip lands in quarkus/dist/target) — required before
# running tests/ in the default "distribution" server mode
./mvnw -pl quarkus/deployment,quarkus/dist -am -DskipTests clean install

# Focused build / unit tests for one module
./mvnw install -Pdistribution -DskipTests -DskipExamples -DskipTestsuite -DskipAdapters -DskipDocs -pl <module> -am
./mvnw test    -Pdistribution -DskipExamples -DskipTestsuite -DskipAdapters -DskipDocs -pl <module> -am

# Single test class / method
./mvnw test -pl services -Dtest=MyTest
./mvnw test -pl tests/base -Dtest='MyTest#myMethod'

# Formatting (run from repo root; apply only when you intend to reformat)
./mvnw -Pdocs,distribution,operator spotless:check
./mvnw -Pdocs,distribution,operator spotless:apply

# Run the server in dev mode (http://localhost:8080, debugger on 5005)
cd quarkus && ../mvnw -f server/pom.xml compile quarkus:dev -Dkc.config.built=true -Dquarkus.args="start-dev"
```

Other notes:
- `adapters`, `distribution`, `operator` and `docs` are only built under Maven profiles of the same name (`-Poperator`, etc.).
- `-DskipProtoLock=true` skips the proto-schema compatibility check (fails behind proxies).
- `.github/scripts/find-modules-with-unit-tests.sh` lists the modules CI runs unit tests for.
- IDE builds depend on Maven-generated sources: build with Maven first, and never "Rebuild Project" in the IDE.
- From IDE, `org.keycloak.Keycloak` in `quarkus/tests/junit5` starts a dev server.

### Frontend (`js/`, PNPM workspace driven by wireit)

```bash
cd js && pnpm install
pnpm build                      # whole workspace
pnpm -C apps/admin-ui lint      # lint one package
pnpm -C apps/admin-ui test
```

Admin UI dev loop: start Keycloak with `KC_ADMIN_VITE_URL=http://localhost:5174` (or `pnpm --filter keycloak-server start --admin-dev`), then run the Vite dev server. Commit `pnpm-lock.yaml` whenever dependencies change. See `js/CODING_GUIDELINES.md`.

## Tests

- **New integration tests go in `tests/`** (mostly `tests/base`) using the Keycloak Test Framework (`test-framework/`, JUnit 5). See `tests/docs/README.md` and `test-framework/docs/`.
- **`testsuite/` (Arquillian, JUnit 4) is deprecated**: no new files; only small additions to existing tests for bug fixes (`testsuite/DEPRECATED.md`). Migration helper: `tests/migration-util` (`./migrate.sh <TestName>`).
- Test framework is configured with `KC_TEST_*` env vars / `kc.test.*` properties, or a `.env.test` file at repo root:
  - `KC_TEST_SERVER=distribution|embedded|remote` (default `distribution` installs the zip from `quarkus/dist`; `embedded` runs in the test JVM and is easiest to debug)
  - `KC_TEST_DATABASE=dev-mem|dev-file|postgres|mysql|mariadb|mssql|oracle|tidb|remote` (containers need the matching `keycloak-test-framework-db-*` dependency)
  - `KC_TEST_SERVER_REUSE=true`, `KC_TEST_DATABASE_REUSE=true` to speed up reruns; `KC_TEST_BROWSER=firefox|chrome` for UI tests.
  - Ports 8080, 8443 and 9001 must be free.
- Custom SPI providers used by tests belong in `tests/custom-providers`; JS script authenticators in `tests/custom-scripts`.
- Don't introduce new test or mocking frameworks.

## Architecture

Keycloak is a Quarkus application assembled from pluggable providers.

- **SPI / provider model** — everything (authenticators, user storage, protocols, event listeners, themes, keys, …) is a `Provider` created by a `ProviderFactory` and grouped under an `Spi` (`server-spi/.../provider/`). Factories are registered via `META-INF/services/<FactoryInterface>` files. `server-spi` holds public, extension-facing contracts; `server-spi-private` holds internal SPIs that may change without notice. Adding a new provider = factory + provider + services file entry.
- **`KeycloakSession`** (`server-spi/.../models/KeycloakSession.java`) is the per-request/transaction entry point: `session.users()`, `session.sessions()`, `session.getProvider(X.class)`, `session.getContext()`. Factories are bootstrapped by `DefaultKeycloakSessionFactory` (`services`).
- **Quarkus build-time augmentation** — `quarkus/deployment` (`KeycloakProcessor`) discovers providers and bakes configuration at build time; `quarkus/runtime` holds runtime startup (`KeycloakMain`), CLI (`kc.sh` commands via Picocli) and config mapping; `quarkus/server` and `quarkus/dist` produce the runnable server. Build-time options require `kc.sh build` / re-augmentation.
- **`services`** — the server's behaviour: JAX-RS resources (`RealmsResource` under `/realms/{realm}`, `AdminRoot` under `/admin`), OIDC/SAML protocol endpoints, the authentication flow engine (`AuthenticationProcessor`, `LoginActionsService`), identity brokering, token creation (`protocol/oidc/TokenManager`).
- **`model/`** — storage implementations: `jpa` (relational DB, Liquibase changelogs in `model/jpa/src/main/resources/META-INF/jpa-changelog-*.xml`), `infinispan` (user/auth sessions, realm/user caches, cluster messaging), `storage*` (managers that combine local JPA storage with federated providers such as `federation/ldap` and `federation/kerberos`). DB schema changes must follow `docs/updating-database-schema.md`.
- **Feature flags** — `common/.../Profile.java` defines `Profile.Feature` (default/preview/experimental/deprecated); code checks them with `Profile.isFeatureEnabled(...)`.
- **Crypto** — `common/.../crypto/CryptoIntegration` selects a `CryptoProvider` via ServiceLoader; implementations in `crypto/default`, `crypto/elytron`, `crypto/fips1402` (FIPS mode picks the provider).
- **UI** — `themes/` holds FreeMarker login/email/account themes; `js/apps/admin-ui` and `js/apps/account-ui` are React apps; `js/libs/keycloak-admin-client` is the TypeScript admin client. `rest/admin-ui-ext` and `rest/admin-v2` are server-side REST for the new admin APIs.
- **Clients** — `integration/` contains the Java admin client, `kcadm`/`kcreg` CLI and client-registration client.
- **Operator** — `operator/` is the Kubernetes operator (built with `-Poperator`).

## Contribution conventions

- One focused change per PR, linked to a GitHub issue; squash to a single commit, rebase on `main` (no merge commits).
- Commit message: short summary, optional body, last line `Closes #<issue>`; sign off with `git commit --signoff`.
- Don't reformat or refactor code unrelated to the change; new dependencies must be discussed first.
- Behaviour changes need tests and documentation (`docs/documentation/`).
- PRs created with AI agents must disclose that in the description.
