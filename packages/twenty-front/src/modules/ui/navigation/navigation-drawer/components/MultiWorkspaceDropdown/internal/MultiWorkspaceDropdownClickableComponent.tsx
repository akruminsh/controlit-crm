import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import {
  StyledContainer,
  StyledIconChevronDown,
  StyledLabel,
  StyledLabelWrapper,
} from '@/ui/navigation/navigation-drawer/components/MultiWorkspaceDropdown/internal/MultiWorkspacesDropdownStyles';
import { NavigationDrawerAnimatedCollapseWrapper } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerAnimatedCollapseWrapper';
import { DEFAULT_WORKSPACE_LOGO } from '@/ui/navigation/navigation-drawer/constants/DefaultWorkspaceLogo';
import { isNavigationDrawerExpandedState } from '@/ui/navigation/states/isNavigationDrawerExpanded';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { isNonEmptyString } from '@sniptt/guards';
import { useContext } from 'react';
import { Avatar } from 'twenty-ui-deprecated/display';
import { ThemeContext } from 'twenty-ui-deprecated/theme-constants';

type MultiWorkspaceDropdownClickableComponentProps = {
  disabled?: boolean;
};

export const MultiWorkspaceDropdownClickableComponent = ({
  disabled,
}: MultiWorkspaceDropdownClickableComponentProps) => {
  const { theme } = useContext(ThemeContext);
  const currentWorkspace = useAtomStateValue(currentWorkspaceState);

  const isNavigationDrawerExpanded = useAtomStateValue(
    isNavigationDrawerExpandedState,
  );

  const currentWorkspaceLogo = isNonEmptyString(currentWorkspace?.logo)
    ? currentWorkspace.logo
    : DEFAULT_WORKSPACE_LOGO;

  return (
    <StyledContainer
      data-testid="workspace-dropdown"
      isNavigationDrawerExpanded={isNavigationDrawerExpanded}
      disabled={disabled}
    >
      <Avatar
        placeholder={currentWorkspace?.displayName || ''}
        avatarUrl={currentWorkspaceLogo}
      />
      <StyledLabelWrapper>
        <NavigationDrawerAnimatedCollapseWrapper>
          <StyledLabel>{currentWorkspace?.displayName ?? ''}</StyledLabel>
        </NavigationDrawerAnimatedCollapseWrapper>
      </StyledLabelWrapper>
      <NavigationDrawerAnimatedCollapseWrapper>
        <StyledIconChevronDown
          size={theme.icon.size.md}
          stroke={theme.icon.stroke.sm}
        />
      </NavigationDrawerAnimatedCollapseWrapper>
    </StyledContainer>
  );
};
