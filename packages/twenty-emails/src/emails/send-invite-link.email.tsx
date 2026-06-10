import { Img } from '@react-email/components';

import { BaseEmail } from 'src/components/BaseEmail';
import { CallToAction } from 'src/components/CallToAction';
import { HighlightedContainer } from 'src/components/HighlightedContainer';
import { HighlightedText } from 'src/components/HighlightedText';
import { MainText } from 'src/components/MainText';
import { Title } from 'src/components/Title';
import { capitalize } from 'src/utils/capitalize';
import { createI18nInstance } from 'src/utils/i18n.utils';
import { type APP_LOCALES } from 'twenty-shared/translations';
import { getImageAbsoluteURI } from 'twenty-shared/utils';

type SendInviteLinkEmailProps = {
  link: string;
  workspace: { name: string | undefined; logo: string | undefined };
  sender: {
    email: string;
    firstName: string;
    lastName: string;
  };
  recipient: {
    email: string;
  };
  serverUrl: string;
  locale: keyof typeof APP_LOCALES;
};

const genericEmailLocalParts = new Set([
  'admin',
  'contact',
  'crm',
  'hello',
  'info',
  'mail',
  'office',
  'sales',
  'support',
  'team',
]);

const getRecipientFirstNameFromEmail = (email: string) => {
  const localPart = email.split('@')[0]?.toLowerCase();

  if (!localPart || genericEmailLocalParts.has(localPart)) {
    return undefined;
  }

  const candidate = localPart
    .split(/[._+-]/)
    .find((part) => part.length > 1 && /[a-z]/.test(part));

  if (!candidate || genericEmailLocalParts.has(candidate)) {
    return undefined;
  }

  return capitalize(candidate.replace(/\d+$/g, ''));
};

export const SendInviteLinkEmail = ({
  link,
  workspace,
  recipient,
  serverUrl,
  locale,
}: SendInviteLinkEmailProps) => {
  const i18n = createI18nInstance(locale);
  const workspaceLogo = workspace.logo
    ? getImageAbsoluteURI({ imageUrl: workspace.logo, baseUrl: serverUrl })
    : null;

  const recipientFirstName = getRecipientFirstNameFromEmail(recipient.email);

  return (
    <BaseEmail width={333} locale={locale}>
      <Title value={i18n._('Accept invitation to Controlit Factory CRM')} />
      <MainText>
        {recipientFirstName ? `Hi ${recipientFirstName},` : 'Hi,'}
      </MainText>
      <MainText>
        {i18n._('You have been invited to join Controlit Factory CRM.')}
      </MainText>
      <MainText>
        {i18n._(
          'Click the button below, then create a new password on the sign-up screen. The password is not included in this email or invitation link.',
        )}
      </MainText>
      <MainText>
        {i18n._(
          'After sign-up, you will have access to contacts, projects, and tasks according to your assigned permissions.',
        )}
      </MainText>
      <MainText>
        {i18n._(
          'If you were not expecting this invitation, you can ignore this email.',
        )}
      </MainText>
      <HighlightedContainer>
        {workspaceLogo ? (
          <Img
            src={workspaceLogo}
            width={40}
            height={40}
            alt="Workspace logo"
          />
        ) : (
          <></>
        )}
        {workspace.name ? <HighlightedText value={workspace.name} /> : <></>}
        <CallToAction href={link} value={i18n._('Accept invitation')} />
      </HighlightedContainer>
    </BaseEmail>
  );
};

SendInviteLinkEmail.PreviewProps = {
  link: 'https://crm.controlitfactory.eu/invite/123',
  workspace: {
    name: 'Controlit Factory',
    logo: 'https://crm.controlitfactory.eu/images/controlit-icon.png',
  },
  sender: {
    email: 'crm@controlitfactory.eu',
    firstName: 'CRM',
    lastName: 'Admin',
  },
  recipient: { email: 'aleksej.kruminsh@gmail.com' },
  serverUrl: 'https://crm.controlitfactory.eu',
  locale: 'en',
} as SendInviteLinkEmailProps;

export default SendInviteLinkEmail;
