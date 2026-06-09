import { isDefined } from 'twenty-shared/utils';

import {
  type CurrentUser,
  currentUserState,
} from '@/auth/states/currentUserState';
import {
  type CurrentWorkspace,
  currentWorkspaceState,
} from '@/auth/states/currentWorkspaceState';
import { calendarBookingPageIdState } from '@/client-config/states/calendarBookingPageIdState';
import { isGoogleCalendarEnabledState } from '@/client-config/states/isGoogleCalendarEnabledState';
import { isGoogleMessagingEnabledState } from '@/client-config/states/isGoogleMessagingEnabledState';
import { isMicrosoftCalendarEnabledState } from '@/client-config/states/isMicrosoftCalendarEnabledState';
import { isMicrosoftMessagingEnabledState } from '@/client-config/states/isMicrosoftMessagingEnabledState';
import { usePermissionFlagMap } from '@/settings/roles/hooks/usePermissionFlagMap';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';

import { useCallback } from 'react';
import {
  OnboardingStatus,
  PermissionFlagType,
} from '~/generated-metadata/graphql';
import { useStore } from 'jotai';

type GetNextOnboardingStatusArgs = {
  currentUser: CurrentUser | null;
  currentWorkspace: CurrentWorkspace | null;
  calendarBookingPageId: string | null;
  isAccountSyncEnabled: boolean;
};

const getNextOnboardingStatus = ({
  currentUser,
  currentWorkspace,
  calendarBookingPageId,
  isAccountSyncEnabled,
}: GetNextOnboardingStatusArgs) => {
  if (currentUser?.onboardingStatus === OnboardingStatus.WORKSPACE_ACTIVATION) {
    return OnboardingStatus.PROFILE_CREATION;
  }

  if (currentUser?.onboardingStatus === OnboardingStatus.PROFILE_CREATION) {
    if (currentWorkspace?.workspaceMembersCount === 1) {
      if (isAccountSyncEnabled) {
        return OnboardingStatus.SYNC_EMAIL;
      }
      return OnboardingStatus.INVITE_TEAM;
    }
    return OnboardingStatus.COMPLETED;
  }
  if (
    currentUser?.onboardingStatus === OnboardingStatus.SYNC_EMAIL &&
    currentWorkspace?.workspaceMembersCount === 1
  ) {
    return OnboardingStatus.INVITE_TEAM;
  }
  if (currentUser?.onboardingStatus === OnboardingStatus.INVITE_TEAM) {
    return isDefined(calendarBookingPageId)
      ? OnboardingStatus.BOOK_ONBOARDING
      : OnboardingStatus.COMPLETED;
  }
  if (currentUser?.onboardingStatus === OnboardingStatus.BOOK_ONBOARDING) {
    return OnboardingStatus.COMPLETED;
  }
  return OnboardingStatus.COMPLETED;
};

export const useSetNextOnboardingStatus = () => {
  const store = useStore();
  const currentUser = useAtomStateValue(currentUserState);
  const currentWorkspace = useAtomStateValue(currentWorkspaceState);
  const calendarBookingPageId = useAtomStateValue(calendarBookingPageIdState);
  const isGoogleCalendarEnabled = useAtomStateValue(
    isGoogleCalendarEnabledState,
  );
  const isGoogleMessagingEnabled = useAtomStateValue(
    isGoogleMessagingEnabledState,
  );
  const isMicrosoftCalendarEnabled = useAtomStateValue(
    isMicrosoftCalendarEnabledState,
  );
  const isMicrosoftMessagingEnabled = useAtomStateValue(
    isMicrosoftMessagingEnabledState,
  );
  const permissionMap = usePermissionFlagMap();
  const isEmailOrCalendarSyncProviderEnabled =
    isGoogleCalendarEnabled ||
    isGoogleMessagingEnabled ||
    isMicrosoftCalendarEnabled ||
    isMicrosoftMessagingEnabled;
  const isAccountSyncEnabled =
    permissionMap[PermissionFlagType.CONNECTED_ACCOUNTS] &&
    isEmailOrCalendarSyncProviderEnabled;

  return useCallback(() => {
    const nextOnboardingStatus = getNextOnboardingStatus({
      currentUser,
      currentWorkspace,
      calendarBookingPageId,
      isAccountSyncEnabled,
    });
    store.set(currentUserState.atom, (current) => {
      if (isDefined(current)) {
        return {
          ...current,
          onboardingStatus: nextOnboardingStatus,
        };
      }
      return current;
    });
  }, [
    currentUser,
    currentWorkspace,
    calendarBookingPageId,
    isAccountSyncEnabled,
    store,
  ]);
};
