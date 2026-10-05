// The card beside the contact form: email, phone, location, class hours and response time.
// A row with no value yet (phone or class hours still TBC) is not shown.

import { BUSINESS, CONTACT_DETAILS, ELEMENT_IDS } from '@/constants';

import styles from './ContactDetails.module.css';

export function ContactDetails() {
  return (
    <aside className={styles.card} aria-labelledby={ELEMENT_IDS.contactDetailsHeading}>
      <h3 id={ELEMENT_IDS.contactDetailsHeading}>{CONTACT_DETAILS.heading}</h3>

      <dl className={styles.rows}>
        <div>
          <dt>{CONTACT_DETAILS.emailLabel}</dt>
          <dd>
            <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>
          </dd>
        </div>

        {BUSINESS.phone && (
          <div>
            <dt>{CONTACT_DETAILS.phoneLabel}</dt>
            <dd>
              <a href={`tel:${BUSINESS.phone}`}>{BUSINESS.phone}</a>
            </dd>
          </div>
        )}

        <div>
          <dt>{CONTACT_DETAILS.locationLabel}</dt>
          <dd>{CONTACT_DETAILS.location}</dd>
        </div>

        {BUSINESS.classHours && (
          <div>
            <dt>{CONTACT_DETAILS.hoursLabel}</dt>
            <dd>{BUSINESS.classHours}</dd>
          </div>
        )}

        <div>
          <dt>{CONTACT_DETAILS.responseLabel}</dt>
          <dd>{CONTACT_DETAILS.response}</dd>
        </div>
      </dl>
    </aside>
  );
}
