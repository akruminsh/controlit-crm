import { act, renderHook } from '@testing-library/react';
import { RecoilRoot, useRecoilState, useSetRecoilState } from 'recoil';

import {
  type CurrentUser,
  currentUserState,
} from '@/auth/states/currentUserState';
import {
  type CurrentWorkspace,
  currentWorkspaceState,
} from '@/auth/states/currentWorkspaceState';
import { isGoogleMessagingEnabledState } from '@/client-config/states/isGoogleMessagingEnabledState';
import { useSetNextOnboardingStatus } from '@/onboarding/hooks/useSetNextOnboardingStatus';
import { OnboardingStatus } from '~/generated/graphql';

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

const getCurrentWorkspace = (
  workspaceMembersCount: number,
): CurrentWorkspace =>
  ({
    id: 'current-workspace-id',
    inviteHash: 'invite-hash',
    displayName: 'Current Workspace',
    workspaceMembersCount,
  }) as CurrentWorkspace;

const renderHooks = (
  onboardingStatus: OnboardingStatus,
  withOneWorkspaceMember = true,
  withSyncProvider = true,
) => {
  const { result } = renderHook(
    () => {
      const [currentUser, setCurrentUser] = useRecoilState(currentUserState);
      const setCurrentWorkspace = useSetRecoilState(currentWorkspaceState);
      const setIsGoogleMessagingEnabled = useSetRecoilState(
        isGoogleMessagingEnabledState,
      );
      const setNextOnboardingStatus = useSetNextOnboardingStatus();
      return {
        currentUser,
        setCurrentUser,
        setCurrentWorkspace,
        setIsGoogleMessagingEnabled,
        setNextOnboardingStatus,
      };
    },
    {
      wrapper: RecoilRoot,
    },
  );
  act(() => {
    result.current.setCurrentUser(getCurrentUser(onboardingStatus));
    result.current.setCurrentWorkspace(
      getCurrentWorkspace(withOneWorkspaceMember ? 1 : 2),
    );
    result.current.setIsGoogleMessagingEnabled(withSyncProvider);
  });
  act(() => {
    result.current.setNextOnboardingStatus();
  });
  return result.current.currentUser?.onboardingStatus;
};

describe('useSetNextOnboardingStatus', () => {
  it('should set next onboarding status for ProfileCreation', () => {
    const nextOnboardingStatus = renderHooks(
      OnboardingStatus.PROFILE_CREATION,
      true,
    );
    expect(nextOnboardingStatus).toEqual(OnboardingStatus.SYNC_EMAIL);
  });

  it('should skip SyncEmail when no sync provider is enabled', () => {
    const nextOnboardingStatus = renderHooks(
      OnboardingStatus.PROFILE_CREATION,
      true,
      false,
    );

    expect(nextOnboardingStatus).toEqual(OnboardingStatus.INVITE_TEAM);
  });

  it('should set next onboarding status for SyncEmail', () => {
    const nextOnboardingStatus = renderHooks(
      OnboardingStatus.SYNC_EMAIL,
      true,
    );
    expect(nextOnboardingStatus).toEqual(OnboardingStatus.INVITE_TEAM);
  });

  it('should skip invite when more than 1 workspaceMember exist', () => {
    const nextOnboardingStatus = renderHooks(
      OnboardingStatus.SYNC_EMAIL,
      false,
    );
    expect(nextOnboardingStatus).toEqual(OnboardingStatus.COMPLETED);
  });

  it('should set next onboarding status for Completed', () => {
    const nextOnboardingStatus = renderHooks(
      OnboardingStatus.INVITE_TEAM,
      true,
    );
    expect(nextOnboardingStatus).toEqual(OnboardingStatus.COMPLETED);
  });
});
