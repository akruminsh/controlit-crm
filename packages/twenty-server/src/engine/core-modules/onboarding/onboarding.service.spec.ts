import { WorkspaceActivationStatus } from 'twenty-shared/workspace';
import { type Repository } from 'typeorm';

import { type BillingService } from 'src/engine/core-modules/billing/services/billing.service';
import { OnboardingStatus } from 'src/engine/core-modules/onboarding/enums/onboarding-status.enum';
import {
  type OnboardingKeyValueTypeMap,
  OnboardingService,
  OnboardingStepKeys,
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

type ConfigKey = Parameters<TwentyConfigService['get']>[0];

const getService = ({
  userVars,
  configValues = {},
}: {
  userVars: Map<OnboardingStepKeys, boolean>;
  configValues?: Partial<Record<ConfigKey, boolean | string | null>>;
}) => {
  const billingService = {
    isSubscriptionIncompleteOnboardingStatus: jest
      .fn()
      .mockResolvedValue(false),
  } as unknown as BillingService;

  const userVarsService = {
    getAll: jest.fn().mockResolvedValue(userVars),
    delete: jest.fn(),
    set: jest.fn(),
  } as unknown as UserVarsService<OnboardingKeyValueTypeMap>;

  const twentyConfigService = {
    get: jest.fn((key: ConfigKey) => configValues[key] ?? false),
  } as unknown as TwentyConfigService;

  const workspaceRepository = {
    findOne: jest.fn().mockResolvedValue(workspace),
  } as unknown as Repository<WorkspaceEntity>;

  return {
    service: new OnboardingService(
      billingService,
      userVarsService,
      twentyConfigService,
      workspaceRepository,
    ),
    userVarsService,
  };
};

describe('OnboardingService', () => {
  it.each([
    'MESSAGING_PROVIDER_GMAIL_ENABLED',
    'CALENDAR_PROVIDER_GOOGLE_ENABLED',
    'MESSAGING_PROVIDER_MICROSOFT_ENABLED',
    'CALENDAR_PROVIDER_MICROSOFT_ENABLED',
  ] satisfies ConfigKey[])(
    'returns SyncEmail when account connection is pending and %s is enabled',
    async (enabledProviderConfigKey) => {
      const { service, userVarsService } = getService({
        userVars: new Map<OnboardingStepKeys, boolean>([
          [OnboardingStepKeys.ONBOARDING_CONNECT_ACCOUNT_PENDING, true],
          [OnboardingStepKeys.ONBOARDING_INVITE_TEAM_PENDING, true],
        ]),
        configValues: {
          [enabledProviderConfigKey]: true,
        },
      });

      await expect(
        service.getOnboardingStatus({ user, workspaceId: workspace.id }),
      ).resolves.toBe(OnboardingStatus.SYNC_EMAIL);
      expect(userVarsService.delete).not.toHaveBeenCalled();
    },
  );

  it('clears stale account connection pending state when all sync providers are disabled', async () => {
    const { service, userVarsService } = getService({
      userVars: new Map<OnboardingStepKeys, boolean>([
        [OnboardingStepKeys.ONBOARDING_CONNECT_ACCOUNT_PENDING, true],
        [OnboardingStepKeys.ONBOARDING_INVITE_TEAM_PENDING, true],
      ]),
    });

    await expect(
      service.getOnboardingStatus({ user, workspaceId: workspace.id }),
    ).resolves.toBe(OnboardingStatus.INVITE_TEAM);

    expect(userVarsService.delete).toHaveBeenCalledWith({
      userId: user.id,
      workspaceId: workspace.id,
      key: OnboardingStepKeys.ONBOARDING_CONNECT_ACCOUNT_PENDING,
    });
  });
});
