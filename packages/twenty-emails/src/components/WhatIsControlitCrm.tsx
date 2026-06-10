import { type I18n } from '@lingui/core';
import { MainText } from 'src/components/MainText';
import { SubTitle } from 'src/components/SubTitle';

type WhatIsControlitCrmProps = {
  i18n: I18n;
};

export const WhatIsControlitCrm = ({ i18n }: WhatIsControlitCrmProps) => {
  return (
    <>
      <SubTitle value={i18n._('What is Controlit Factory CRM?')} />
      <MainText>
        {i18n._(
          "It's a CRM workspace for managing customer contacts, projects, tasks, and related sales activity.",
        )}
      </MainText>
    </>
  );
};
