import { useRecoilCallback, useRecoilValue } from 'recoil';

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
import { isDefined } from 'twenty-shared/utils';
import { OnboardingStatus } from '~/generated/graphql';

const getNextStatusAfterSyncEmail = (
  currentWorkspace: CurrentWorkspace | null,
) => {
  if (currentWorkspace?.workspaceMembersCount === 1) {
    return OnboardingStatus.INVITE_TEAM;
  }

  return OnboardingStatus.COMPLETED;
};

const getNextOnboardingStatus = (
  currentUser: CurrentUser | null,
  currentWorkspace: CurrentWorkspace | null,
  calendarBookingPageId: string | null,
  hasEmailOrCalendarSyncProvider: boolean,
) => {
  if (currentUser?.onboardingStatus === OnboardingStatus.WORKSPACE_ACTIVATION) {
    return OnboardingStatus.PROFILE_CREATION;
  }

  if (currentUser?.onboardingStatus === OnboardingStatus.PROFILE_CREATION) {
    return hasEmailOrCalendarSyncProvider
      ? OnboardingStatus.SYNC_EMAIL
      : getNextStatusAfterSyncEmail(currentWorkspace);
  }
  if (currentUser?.onboardingStatus === OnboardingStatus.SYNC_EMAIL) {
    return getNextStatusAfterSyncEmail(currentWorkspace);
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
  const currentUser = useRecoilValue(currentUserState);
  const currentWorkspace = useRecoilValue(currentWorkspaceState);
  const calendarBookingPageId = useRecoilValue(calendarBookingPageIdState);
  const isGoogleMessagingEnabled = useRecoilValue(
    isGoogleMessagingEnabledState,
  );
  const isGoogleCalendarEnabled = useRecoilValue(isGoogleCalendarEnabledState);
  const isMicrosoftMessagingEnabled = useRecoilValue(
    isMicrosoftMessagingEnabledState,
  );
  const isMicrosoftCalendarEnabled = useRecoilValue(
    isMicrosoftCalendarEnabledState,
  );

  const hasEmailOrCalendarSyncProvider =
    isGoogleMessagingEnabled ||
    isGoogleCalendarEnabled ||
    isMicrosoftMessagingEnabled ||
    isMicrosoftCalendarEnabled;

  return useRecoilCallback(
    ({ set }) =>
      () => {
        const nextOnboardingStatus = getNextOnboardingStatus(
          currentUser,
          currentWorkspace,
          calendarBookingPageId,
          hasEmailOrCalendarSyncProvider,
        );
        set(currentUserState, (current) => {
          if (isDefined(current)) {
            return {
              ...current,
              onboardingStatus: nextOnboardingStatus,
            };
          }
          return current;
        });
      },
    [
      currentWorkspace,
      currentUser,
      calendarBookingPageId,
      hasEmailOrCalendarSyncProvider,
    ],
  );
};
