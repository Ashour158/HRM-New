import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { AuthSessionStore } from './auth-session.store.js';
import { AuthTokenRepository } from './auth-token.repository.js';
import { LoginRateLimitGuard } from './login-rate-limit.guard.js';
import { SsoConfigService } from './sso-config.service.js';
import { SsoAuthTransactionRepository } from './sso-auth-transaction.repository.js';
import { SsoOidcService } from './sso-oidc.service.js';
import { SsoSamlService } from './sso-saml.service.js';
import { TenantIdentityProviderRepository } from './tenant-identity-provider.repository.js';
import { UsersRepository } from './users.repository.js';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    UsersRepository,
    AuthSessionStore,
    AuthTokenRepository,
    LoginRateLimitGuard,
    TenantIdentityProviderRepository,
    SsoAuthTransactionRepository,
    SsoConfigService,
    SsoOidcService,
    SsoSamlService,
  ],
  exports: [AuthService, SsoConfigService, TenantIdentityProviderRepository, SsoAuthTransactionRepository],
})
export class AuthModule {}
