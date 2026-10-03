import { UserManager, UserManagerSettings } from 'oidc-client-ts';

// Configurable for on-premise air-gapped Keycloak installation
const keycloakSettings: UserManagerSettings = {
  authority: import.meta.env.VITE_KEYCLOAK_URL || 'https://auth.facility.lan/realms/vms-acs',
  client_id: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'vms-acs-frontend',
  redirect_uri: `${window.location.origin}/auth/callback`,
  response_type: 'code',
  scope: 'openid profile email roles',
  post_logout_redirect_uri: window.location.origin,
  automaticSilentRenew: true,
  silent_redirect_uri: `${window.location.origin}/auth/silent-renew.html`,
};

export class KeycloakAuthService {
  private userManager: UserManager;

  constructor() {
    this.userManager = new UserManager(keycloakSettings);
  }

  public async login(): Promise<void> {
    try {
      await this.userManager.signinRedirect();
    } catch (err) {
      console.warn('Air-Gapped Keycloak redirect failed, fallback to local LAN vault:', err);
      throw err;
    }
  }

  public async handleCallback(): Promise<any> {
    return await this.userManager.signinCallback();
  }

  public async logout(): Promise<void> {
    try {
      await this.userManager.signoutRedirect();
    } catch {
      await this.userManager.removeUser();
    }
  }

  public async getUser(): Promise<any> {
    return await this.userManager.getUser();
  }
}

export const keycloakService = new KeycloakAuthService();
