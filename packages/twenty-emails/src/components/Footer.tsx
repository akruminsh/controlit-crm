import { type I18n } from '@lingui/core';
import { Column, Container, Row } from '@react-email/components';
import { Link } from 'src/components/Link';
import { ShadowText } from 'src/components/ShadowText';

const footerContainerStyle = {
  marginTop: '12px',
};

type FooterProps = {
  i18n: I18n;
};

export const Footer = ({ i18n }: FooterProps) => {
  return (
    <Container style={footerContainerStyle}>
      <Row>
        <Column>
          <ShadowText>
            <Link
              href="https://crm.controlitfactory.eu"
              value={i18n._('Controlit Factory CRM')}
              aria-label={i18n._('Open Controlit Factory CRM')}
            />
          </ShadowText>
        </Column>
      </Row>
      <ShadowText>
        <>
          {i18n._('This is an automated Controlit Factory CRM notification.')}
          <br />
          {i18n._('Please do not share secure links from this email.')}
        </>
      </ShadowText>
    </Container>
  );
};
