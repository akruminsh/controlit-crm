import { WorkspaceActivationStatus } from 'twenty-shared/workspace';

import { type BillingService } from 'src/engine/core-modules/billing/services/billing.service';
import { OnboardingStatus } from 'src/engine/core-modules/onboarding/enums/onboarding-status.enum';
import {
  OnboardingService,
  OnboardingStepKeys,
  type OnboardingKeyValueTypeMap,
} from 'src/engine/core-modules/onboarding/onboarding.service';
import { type TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { type UserVarsService } from 'src/engine/core-modules/user/user-vars/services/user-vars.service';
import { type UserEntity } from 'src/engine/core-modules/user/user.entity';
import { type WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';

const user = { id: 'user-id' } as UserEntity;
const workspace = {
  id: 'workspace-id',
  activationStatus: WorkspaceActivationStatus.ACTIVE,
} as WorkspaceEntity;

const getService = ({
  userVars,
  configValues = {},
}: {
  userVars: Map<OnboardingStepKeys, boolean>;
  configValues?: Partial<Record<string, boolean | string | null>>;
}) => {
  const billingService = {
    isSubscriptionIncompleteOnboardingStatus: jest.fn().mockResolvedValue(false),
  } as unknown as BillingService;

  const userVarsService = {
    getAll: jest.fn().mockResolvedValue(userVars),
    delete: jest.fn(),
    set: jest.fn(),
  } as unknown as UserVarsService<OnboardingKeyValueTypeMap>;

  const twentyConfigService = {
    get: jest.fn((key: string) => configValues[key] ?? false),
  } as unknown as TwentyConfigService;

  return {
    service: new OnboardingService(
      billingService,
      userVarsService,
      twentyConfigService,
    ),
    userVarsService,
  };
};

describe('OnboardingService', () => {
  it('returns SyncEmail when account connection is pending and a sync provider is enabled', async () => {
    const { service, userVarsService } = getService({
      userVars: new Map<OnboardingStepKeys, boolean>([
        [OnboardingStepKeys.ONBOARDING_CONNECT_ACCOUNT_PENDING, true],
        [OnboardingStepKeys.ONBOARDING_INVITE_TEAM_PENDING, true],
      ]),
      configValues: {
        MESSAGING_PROVIDER_GMAIL_ENABLED: true,
      },
    });

    await expect(service.getOnboardingStatus(user, workspace)).resolves.toBe(
      OnboardingStatus.SYNC_EMAIL,
    );
    expect(userVarsService.delete).not.toHaveBeenCalled();
  });

  it('skips stale account connection pending state when no sync provider is enabled', async () => {
    const { service, userVarsService } = getService({
      userVars: new Map<OnboardingStepKeys, boolean>([
        [OnboardingStepKeys.ONBOARDING_CONNECT_ACCOUNT_PENDING, true],
        [OnboardingStepKeys.ONBOARDING_INVITE_TEAM_PENDING, true],
      ]),
    });

    await expect(service.getOnboardingStatus(user, workspace)).resolves.toBe(
      OnboardingStatus.INVITE_TEAM,
    );
    expect(userVarsService.delete).toHaveBeenCalledWith(
      {
        userId: user.id,
        workspaceId: workspace.id,
        key: OnboardingStepKeys.ONBOARDING_CONNECT_ACCOUNT_PENDING,
      },
      undefined,
    );
  });
});
