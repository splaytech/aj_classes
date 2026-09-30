// The "Register your interest" section: heading, intro, response promise and the form.

import { Section } from '@/components/ui';
import { BUSINESS, CONTACT_FORM, SECTION_IDS } from '@/constants';

import { ContactForm } from './ContactForm';
import styles from './ContactForm.module.css';

export function ContactSection() {
  return (
    <Section id={SECTION_IDS.contact} heading={CONTACT_FORM.heading} tone="subtle">
      <p>{CONTACT_FORM.intro}</p>
      <p className={styles.privacy}>
        {CONTACT_FORM.responsePromise}
        {CONTACT_FORM.space}
        <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>
      </p>
      <ContactForm />
    </Section>
  );
}
