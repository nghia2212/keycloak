# Keycloak diagrams

Diagram được vẽ bằng [Archify](https://github.com/tt-a1i/archify). Mỗi diagram có hai file cùng tên:
`.json` là nguồn (đọc / sửa / tìm kiếm được, mỗi node có `sources` trỏ tới file và dòng code),
`.html` là bản xem (mở trong trình duyệt).

## Kiến trúc

Hệ thống chạy thế nào và mã nguồn chia tầng ra sao.

| Diagram | Loại | Nội dung | File |
| --- | --- | --- | --- |
| **Keycloak Source Architecture** | architecture | Module Maven theo tầng (assembly / implementations / SPI) và phụ thuộc giữa chúng, lấy từ pom.xml | [html](architecture/module-layers.architecture.html) · [json](architecture/module-layers.architecture.json) |
| **Keycloak Runtime Architecture** | architecture | Luồng đăng nhập OIDC lúc chạy: browser → endpoint → auth flow → session → token; DB, LDAP, IdP ngoài và ranh giới tin cậy | [html](architecture/runtime-login-flow.architecture.html) · [json](architecture/runtime-login-flow.architecture.json) |

## Cấu trúc mã nguồn

Cây module Maven; node có "class diagram ↗" bấm được để mở class diagram của module.

| Diagram | Loại | Nội dung | File |
| --- | --- | --- | --- |
| **Keycloak Maven modules** | tree | 29 module cấp 1 và submodule, nhóm theo trách nhiệm; link sang class diagram | [html](structure/maven-modules.tree.html) · [json](structure/maven-modules.tree.json) |

## Chức năng & menu

Chức năng của app đang chạy và menu / tab tương ứng.

| Diagram | Loại | Nội dung | File |
| --- | --- | --- | --- |
| **Keycloak chức năng và menu** | tree | Menu Admin Console và Account Console đọc từ app đang chạy, kèm tab và menu ẩn theo điều kiện | [html](features/admin-account-menus.tree.html) · [json](features/admin-account-menus.tree.json) |

## Class diagram theo module

Mỗi module (hoặc submodule) Maven một diagram. ✋ = chỉnh tay từ source; còn lại sinh bởi `tools/gen-class-diagrams.mjs`.

| Module | Số lớp vẽ | Lớp chính | File |
| --- | --- | --- | --- |
| **adapters/saml** | 14 | `SamlDeployment`, `IDP`, `AbstractKeycloakSamlAdapterV1Parser`, `SP` | [html](class-diagram/adapters-saml.class.html) · [json](class-diagram/adapters-saml.class.json) |
| **adapters/spi** | 12 | `SessionIdMapper`, `HttpFacade`, `KeycloakAccount`, `AuthenticationError` | [html](class-diagram/adapters-spi.class.html) · [json](class-diagram/adapters-spi.class.json) |
| **authz/client** | 14 | `ServerConfiguration`, `Configuration`, `Http`, `TokenCallable` | [html](class-diagram/authz-client.class.html) · [json](class-diagram/authz-client.class.json) |
| **authz/policy** | 17 | `AbstractPermissionProvider`, `JSPolicyProviderFactory`, `AggregatePolicyProviderFactory`, `GroupPolicyProviderFactory` | [html](class-diagram/authz-policy.class.html) · [json](class-diagram/authz-policy.class.json) |
| **authzen/services** | 7 | `AuthZen`, `AuthZenRealmResourceProviderFactory`, `AuthZenWellKnownProvider`, `AuthZenRealmResourceProvider` | [html](class-diagram/authzen-services.class.html) · [json](class-diagram/authzen-services.class.json) |
| ✋ **common** | 16 | `Profile.Feature`, `Profile`, `FeatureConfig`, `ProfileConfigResolver` | [html](class-diagram/common.class.html) · [json](class-diagram/common.class.json) |
| **core** | 14 | `RealmRepresentation`, `JWK`, `Algorithm`, `JsonWebToken` | [html](class-diagram/core.class.html) · [json](class-diagram/core.class.json) |
| **crypto/default** | 15 | `Argon2Parameters`, `DefaultRsaKeyEncryptionJWEAlgorithmProvider`, `BlockChunkManager`, `DefaultCryptoProvider` | [html](class-diagram/crypto-default.class.html) · [json](class-diagram/crypto-default.class.json) |
| **crypto/elytron** | 11 | `ElytronRsaKeyEncryptionJWEAlgorithmProvider`, `WildFlyElytronProvider`, `ElytronCertificateUtilsProvider`, `ElytronEcdhEsAlgorithmProvider` | [html](class-diagram/crypto-elytron.class.html) · [json](class-diagram/crypto-elytron.class.json) |
| **crypto/fips1402** | 11 | `FIPS1402Provider`, `BCFIPSCertificateUtilsProvider`, `BCFIPSEcdhEsAlgorithmProvider`, `BCFIPSECDSACryptoProvider` | [html](class-diagram/crypto-fips1402.class.html) · [json](class-diagram/crypto-fips1402.class.json) |
| **federation/ipatuura** | 8 | `Ipatuura`, `SCIMUser`, `IpatuuraUserStorageProvider`, `IpatuuraAuthenticator` | [html](class-diagram/federation-ipatuura.class.html) · [json](class-diagram/federation-ipatuura.class.json) |
| **federation/kerberos** | 9 | `CommonKerberosConfig`, `KerberosFederationProvider`, `KerberosPrincipal`, `KerberosServerSubjectAuthenticator` | [html](class-diagram/federation-kerberos.class.html) · [json](class-diagram/federation-kerberos.class.json) |
| **federation/ldap** | 14 | `LDAPStorageProvider`, `LDAPObject`, `AbstractLDAPStorageMapper`, `LDAPConfig` | [html](class-diagram/federation-ldap.class.html) · [json](class-diagram/federation-ldap.class.json) |
| **federation/sssd** | 14 | `CLibrary`, `InfoPipe`, `PAMLibrary`, `BSDCLibrary` | [html](class-diagram/federation-sssd.class.html) · [json](class-diagram/federation-sssd.class.json) |
| **integration/admin-client-core** | 14 | `Keycloak`, `RealmResource`, `UserResource`, `RoleMappingResource` | [html](class-diagram/integration-admin-client-core.class.html) · [json](class-diagram/integration-admin-client-core.class.json) |
| **integration/admin-client-jackson3** | 5 | `Jackson3RawJsonValueSupport`, `StreamMessageBodyReader3`, `Jackson3JsonMapper`, `JacksonProvider3` | [html](class-diagram/integration-admin-client-jackson3.class.html) · [json](class-diagram/integration-admin-client-jackson3.class.json) |
| **integration/admin-client** | 4 | `ResteasyClientClassicProvider`, `StreamMessageBodyReader`, `JacksonProvider`, `ClientBuilderWrapper` | [html](class-diagram/integration-admin-client.class.html) · [json](class-diagram/integration-admin-client.class.json) |
| **integration/client-cli** | 14 | `ConfigData`, `OsUtil`, `IoUtil`, `KcAdmMain` | [html](class-diagram/integration-client-cli.class.html) · [json](class-diagram/integration-client-cli.class.json) |
| **integration/client-registration** | 4 | `Auth`, `HttpErrorException`, `ClientRegistration`, `ClientRegistrationException` | [html](class-diagram/integration-client-registration.class.html) · [json](class-diagram/integration-client-registration.class.json) |
| **model/infinispan** | 14 | `Marshalling`, `InfinispanConnectionProvider`, `AbstractRevisioned`, `InvalidationEvent` | [html](class-diagram/model-infinispan.class.html) · [json](class-diagram/model-infinispan.class.json) |
| ✋ **model/jpa** | 15 | `DefaultJpaConnectionProvider`, `JpaConnectionProvider`, `JpaUpdaterProvider`, `LiquibaseJpaUpdaterProvider` | [html](class-diagram/model-jpa.class.html) · [json](class-diagram/model-jpa.class.json) |
| **model/storage-private** | 14 | `RealmMigration`, `UserSessionPersisterProvider`, `CacheRealmProvider`, `AbstractReadOnlyClientStorageAdapter` | [html](class-diagram/model-storage-private.class.html) · [json](class-diagram/model-storage-private.class.json) |
| **model/storage-services** | 16 | `ExportImportSessionTask`, `AbstractFileBasedImportProvider`, `MultipleStepsExportProvider`, `ImportUtils` | [html](class-diagram/model-storage-services.class.html) · [json](class-diagram/model-storage-services.class.json) |
| **model/storage** | 15 | `UserStorageProvider`, `UserFederatedStorageProvider`, `AbstractUserAdapter`, `UserStorageProviderFactory` | [html](class-diagram/model-storage.class.html) · [json](class-diagram/model-storage.class.json) |
| **operator** | 14 | `CRDUtils`, `KeycloakSpec`, `Utils`, `ContextUtils` | [html](class-diagram/operator.class.html) · [json](class-diagram/operator.class.json) |
| **quarkus/config-api** | 14 | `Option`, `OptionBuilder`, `OptionCategory`, `OptionsUtil` | [html](class-diagram/quarkus-config-api.class.html) · [json](class-diagram/quarkus-config-api.class.json) |
| **quarkus/deployment** | 10 | `IsKeycloakDevMode`, `IsManagementEnabled`, `IsReAugmentation`, `CheckJdbcBuildStep` | [html](class-diagram/quarkus-deployment.class.html) · [json](class-diagram/quarkus-deployment.class.json) |
| **quarkus/runtime** | 14 | `Configuration`, `PropertyMapper`, `Environment`, `PropertyMapperGrouping` | [html](class-diagram/quarkus-runtime.class.html) · [json](class-diagram/quarkus-runtime.class.json) |
| **rest/admin-ui-ext** | 14 | `RoleMappingResource`, `ClientRole`, `Authentication`, `RoleMapper` | [html](class-diagram/rest-admin-ui-ext.class.html) · [json](class-diagram/rest-admin-ui-ext.class.json) |
| **rest/admin-v2** | 14 | `BaseClientRepresentation`, `OIDCClientRepresentation`, `BaseClientModelSchema`, `ClientsApi` | [html](class-diagram/rest-admin-v2.class.html) · [json](class-diagram/rest-admin-v2.class.json) |
| **saml-core-api** | 14 | `ExtensionType`, `ExtensionListType`, `ExtensionOnlyType`, `RequestAbstractType` | [html](class-diagram/saml-core-api.class.html) · [json](class-diagram/saml-core-api.class.json) |
| **saml-core** | 14 | `StaxParserUtil`, `PicketLinkLogger`, `PicketLinkLoggerFactory`, `SAMLMetadataQNames` | [html](class-diagram/saml-core.class.html) · [json](class-diagram/saml-core.class.json) |
| **scim/client** | 11 | `AbstractScimResourceClient`, `ScimClient`, `AuthorizationMethod`, `ResourceFilter` | [html](class-diagram/scim-client.class.html) · [json](class-diagram/scim-client.class.json) |
| **scim/core** | 14 | `ResourceTypeRepresentation`, `Attribute`, `ModelSchema`, `ScimResourceTypeProvider` | [html](class-diagram/scim-core.class.html) · [json](class-diagram/scim-core.class.json) |
| **scim/model** | 16 | `ScimAttributeJpaExpressionResolver`, `AbstractUserModelSchema`, `ScimJPAPredicateEvaluator`, `UserExtensionModelSchema` | [html](class-diagram/scim-model.class.html) · [json](class-diagram/scim-model.class.json) |
| **scim/services** | 3 | `ScimResourceTypeResource`, `ScimRealmResource`, `ScimRealmResourceFactory` | [html](class-diagram/scim-services.class.html) · [json](class-diagram/scim-services.class.json) |
| **server-spi-private** | 14 | `Scope`, `Policy`, `ResourceServer`, `AuthorizationProvider` | [html](class-diagram/server-spi-private.class.html) · [json](class-diagram/server-spi-private.class.json) |
| ✋ **server-spi** | 17 | `Spi`, `ProviderFactory<T>`, `Provider`, `KeycloakSessionFactory` | [html](class-diagram/server-spi.class.html) · [json](class-diagram/server-spi.class.json) |
| ✋ **services** | 15 | `RealmsResource`, `AdminRoot`, `OIDCLoginProtocolService`, `LoginActionsService` | [html](class-diagram/services.class.html) · [json](class-diagram/services.class.json) |
| **ssf/core** | 14 | `SubjectId`, `SsfEvent`, `SsfEventProvider`, `AbstractDeliveryMethodRepresentation` | [html](class-diagram/ssf-core.class.html) · [json](class-diagram/ssf-core.class.json) |
| **ssf/services** | 6 | `SsfAdminResource`, `SsfRealmResourceProvider`, `SsfAdminRealmResourceProvider`, `SsfBootstrap` | [html](class-diagram/ssf-services.class.html) · [json](class-diagram/ssf-services.class.json) |
| **ssf/transmitter** | 14 | `SsfTransmitterProvider`, `StreamConfig`, `ClientStreamStore`, `SsfTransmitterConfig` | [html](class-diagram/ssf-transmitter.class.html) · [json](class-diagram/ssf-transmitter.class.json) |
| **util/embedded-ldap** | 5 | `TLS13StartTlsHandler`, `JdbmPartitionFactoryFast`, `RangedAttributeInterceptor`, `LDAPEmbeddedServer` | [html](class-diagram/util-embedded-ldap.class.html) · [json](class-diagram/util-embedded-ldap.class.json) |

## Công cụ

| Script | Việc |
| --- | --- |
| `tools/finalize-all.sh` | Build + kiểm tra mọi diagram bằng Archify, chèn link vào cây module, tạo lại README này |
| `tools/gen-class-diagrams.mjs` | Sinh class diagram từ `src/main/java` (bỏ qua diagram chỉnh tay) |
| `tools/link-diagrams.mjs` | Biến "class diagram ↗" trong cây module thành link |
| `tools/build-index.mjs` | Tạo README này |

`.receipts/` chứa kết quả kiểm tra của Archify; `*.delivery.json` cạnh mỗi `.html` là biên nhận do Archify ghi.
