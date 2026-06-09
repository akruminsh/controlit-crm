import { act, renderHook } from '@testing-library/react';
import { createElement } from 'react';
import { Provider as JotaiProvider } from 'jotai';
import { v4 } from 'uuid';

import {
  type CurrentUser,
  currentUserState,
} from '@/auth/states/currentUserState';
import {
  type CurrentUserWorkspace,
  currentUserWorkspaceState,
} from '@/auth/states/currentUserWorkspaceState';
import {
  type CurrentWorkspace,
  currentWorkspaceState,
} from '@/auth/states/currentWorkspaceState';
import { isGoogleCalendarEnabledState } from '@/client-config/states/isGoogleCalendarEnabledState';
import { isGoogleMessagingEnabledState } from '@/client-config/states/isGoogleMessagingEnabledState';
import { isMicrosoftCalendarEnabledState } from '@/client-config/states/isMicrosoftCalendarEnabledState';
import { isMicrosoftMessagingEnabledState } from '@/client-config/states/isMicrosoftMessagingEnabledState';
import { useSetNextOnboardingStatus } from '@/onboarding/hooks/useSetNextOnboardingStatus';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';
import {
  jotaiStore,
  resetJotaiStore,
} from '@/ui/utilities/state/jotai/jotaiStore';

import {
  OnboardingStatus,
  PermissionFlagType,
  SubscriptionStatus,
} from '~/generated-metadata/graphql';

const Wrapper = ({ children }: { children: React.ReactNode }) =>
  createElement(JotaiProvider, { store: jotaiStore }, children);

type SyncProviderFlags = {
  isGoogleCalendarEnabled: boolean;
  isGoogleMessagingEnabled: boolean;
  isMicrosoftCalendarEnabled: boolean;
  isMicrosoftMessagingEnabled: boolean;
};

const enabledSyncProviderFlags: SyncProviderFlags = {
  isGoogleCalendarEnabled: false,
  isGoogleMessagingEnabled: true,
  isMicrosoftCalendarEnabled: false,
  isMicrosoftMessagingEnabled: false,
};

const disabledSyncProviderFlags: SyncProviderFlags = {
  isGoogleCalendarEnabled: false,
  isGoogleMessagingEnabled: false,
  isMicrosoftCalendarEnabled: false,
  isMicrosoftMessagingEnabled: false,
};

const connectedAccountPermissionFlags = [
  PermissionFlagType.WORKSPACE_MEMBERS,
  PermissionFlagType.CONNECTED_ACCOUNTS,
];

const getCurrentUser = (onboardingStatus: OnboardingStatus): CurrentUser => ({
  id: 'current-user-id',
  email: 'current-user@example.com',
  firstName: 'Current',
  lastName: 'User',
  supportUserHash: '',
  canAccessFullAdminPanel: false,
  canImpersonate: false,
  onboardingStatus,
  userVars: [],
  hasPassword: true,
});

const getCurrentUserWorkspace = (
  permissionFlags: PermissionFlagType[],
): CurrentUserWorkspace => ({
  permissionFlags,
  twoFactorAuthenticationMethodSummary: [],
  objectsPermissions: [],
});

const getCurrentWorkspace = ({
  withCurrentBillingSubscription,
  withOneWorkspaceMember,
}: {
  withCurrentBillingSubscription: boolean;
  withOneWorkspaceMember: boolean;
}): CurrentWorkspace =>
  ({
    id: 'current-workspace-id',
    inviteHash: 'invite-hash',
    displayName: 'Current Workspace',
    currentBillingSubscription: withCurrentBillingSubscription
      ? {
          id: v4(),
          status: SubscriptionStatus.Active,
          metadata: {},
          phases: [],
        }
      : undefined,
    workspaceMembersCount: withOneWorkspaceMember ? 1 : 2,
  }) as CurrentWorkspace;

const renderHooks = (
  onboardingStatus: OnboardingStatus,
  withCurrentBillingSubscription: boolean,
  withOneWorkspaceMember = true,
  permissionFlags = connectedAccountPermissionFlags,
  syncProviderFlags = enabledSyncProviderFlags,
) => {
  const { result } = renderHook(
    () => {
      const [currentUser, setCurrentUser] = useAtomState(currentUserState);
      const setCurrentUserWorkspace = useSetAtomState(
        currentUserWorkspaceState,
      );
      const setCurrentWorkspace = useSetAtomState(currentWorkspaceState);
      const setIsGoogleCalendarEnabled = useSetAtomState(
        isGoogleCalendarEnabledState,
      );
      const setIsGoogleMessagingEnabled = useSetAtomState(
        isGoogleMessagingEnabledState,
      );
      const setIsMicrosoftCalendarEnabled = useSetAtomState(
        isMicrosoftCalendarEnabledState,
      );
      const setIsMicrosoftMessagingEnabled = useSetAtomState(
        isMicrosoftMessagingEnabledState,
      );
      const setNextOnboardingStatus = useSetNextOnboardingStatus();
      return {
        currentUser,
        setCurrentUser,
        setCurrentWorkspace,
        setCurrentUserWorkspace,
        setIsGoogleCalendarEnabled,
        setIsGoogleMessagingEnabled,
        setIsMicrosoftCalendarEnabled,
        setIsMicrosoftMessagingEnabled,
        setNextOnboardingStatus,
      };
    },
    {
      wrapper: Wrapper,
    },
  );
  act(() => {
    result.current.setCurrentUser(getCurrentUser(onboardingStatus));
    result.current.setCurrentUserWorkspace(
      getCurrentUserWorkspace(permissionFlags),
    );
    result.current.setCurrentWorkspace(
      getCurrentWorkspace({
        withCurrentBillingSubscription,
        withOneWorkspaceMember,
      }),
    );
    result.current.setIsGoogleCalendarEnabled(
      syncProviderFlags.isGoogleCalendarEnabled,
    );
    result.current.setIsGoogleMessagingEnabled(
      syncProviderFlags.isGoogleMessagingEnabled,
    );
    result.current.setIsMicrosoftCalendarEnabled(
      syncProviderFlags.isMicrosoftCalendarEnabled,
    );
    result.current.setIsMicrosoftMessagingEnabled(
      syncProviderFlags.isMicrosoftMessagingEnabled,
    );
  });
  act(() => {
    result.current.setNextOnboardingStatus();
  });
  return result.current.currentUser?.onboardingStatus;
};

describe('useSetNextOnboardingStatus', () => {
  beforeEach(() => {
    resetJotaiStore();
  });

  it('should set next onboarding status for ProfileCreation', () => {
    const nextOnboardingStatus = renderHooks(
      OnboardingStatus.PROFILE_CREATION,
      false,
      true,
    );
    expect(nextOnboardingStatus).toEqual(OnboardingStatus.SYNC_EMAIL);
  });

  it.each([
    [
      'Google calendar',
      { ...disabledSyncProviderFlags, isGoogleCalendarEnabled: true },
    ],
    [
      'Google messaging',
      { ...disabledSyncProviderFlags, isGoogleMessagingEnabled: true },
    ],
    [
      'Microsoft calendar',
      { ...disabledSyncProviderFlags, isMicrosoftCalendarEnabled: true },
    ],
    [
      'Microsoft messaging',
      { ...disabledSyncProviderFlags, isMicrosoftMessagingEnabled: true },
    ],
  ] satisfies [string, SyncProviderFlags][])(
    'should set next onboarding status for ProfileCreation when %s is enabled',
    (_, syncProviderFlags) => {
      const nextOnboardingStatus = renderHooks(
        OnboardingStatus.PROFILE_CREATION,
        false,
        true,
        connectedAccountPermissionFlags,
        syncProviderFlags,
      );

      expect(nextOnboardingStatus).toEqual(OnboardingStatus.SYNC_EMAIL);
    },
  );

  it('should skip SyncEmail when user is not first workspace member', () => {
    const nextOnboardingStatus = renderHooks(
      OnboardingStatus.PROFILE_CREATION,
      false,
      false,
    );
    expect(nextOnboardingStatus).toEqual(OnboardingStatus.COMPLETED);
  });

  it('should skip SyncEmail when no sync provider is enabled', () => {
    const nextOnboardingStatus = renderHooks(
      OnboardingStatus.PROFILE_CREATION,
      false,
      true,
      connectedAccountPermissionFlags,
      disabledSyncProviderFlags,
    );

    expect(nextOnboardingStatus).toEqual(OnboardingStatus.INVITE_TEAM);
  });

  it('should skip SyncEmail when account sync is disabled', () => {
    const nextOnboardingStatus = renderHooks(
      OnboardingStatus.PROFILE_CREATION,
      false,
      true,
      [PermissionFlagType.WORKSPACE_MEMBERS],
    );
    expect(nextOnboardingStatus).toEqual(OnboardingStatus.INVITE_TEAM);
  });

  it('should set next onboarding status for SyncEmail', () => {
    const nextOnboardingStatus = renderHooks(
      OnboardingStatus.SYNC_EMAIL,
      false,
      true,
    );
    expect(nextOnboardingStatus).toEqual(OnboardingStatus.INVITE_TEAM);
  });

  it('should skip invite when more than 1 workspaceMember exist', () => {
    const nextOnboardingStatus = renderHooks(
      OnboardingStatus.SYNC_EMAIL,
      true,
      false,
    );
    expect(nextOnboardingStatus).toEqual(OnboardingStatus.COMPLETED);
  });

  it('should set next onboarding status for Completed', () => {
    const nextOnboardingStatus = renderHooks(
      OnboardingStatus.INVITE_TEAM,
      true,
      true,
    );
    expect(nextOnboardingStatus).toEqual(OnboardingStatus.COMPLETED);
  });
});
