// The "Register your interest" section: heading, intro, the form and a contact details card.

import { Section } from '@/components/ui';
import { CONTACT_FORM, SECTION_IDS } from '@/constants';

import { ContactDetails } from './ContactDetails';
import { ContactForm } from './ContactForm';
import styles from './ContactSection.module.css';

export function ContactSection() {
  return (
    <Section id={SECTION_IDS.contact} heading={CONTACT_FORM.heading} tone="subtle">
      <p>{CONTACT_FORM.intro}</p>
      <div className={styles.layout}>
        <ContactForm />
        <ContactDetails />
      </div>
    </Section>
  );
}
