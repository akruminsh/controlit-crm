import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui-deprecated/theme-constants';

export const StyledOnboardingContentContainer = styled.div`
  box-sizing: border-box;
  margin-bottom: ${themeCssVariables.spacing[8]};
  margin-top: ${themeCssVariables.spacing[4]};
  max-width: 100%;
  min-width: 240px;
  width: 333px;
`;
