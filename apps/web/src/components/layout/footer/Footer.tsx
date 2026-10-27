// Navy site footer: subscribe form, social links, contact details and legal links (News only
// when posts exist).

import { Container, Logo } from '@/components/ui';
import {
  A11Y,
  APP_CONFIG,
  BUSINESS,
  CAREERS,
  FOOTER,
  FOOTER_PORTAL,
  PORTAL_ROUTES,
  RESOURCES,
  ROUTES,
  SOCIAL_LABELS,
  SUBSCRIBE,
  TAGLINE,
} from '@/constants';
import { getVisibleSocialLinks } from '@/lib/social';
import { useHasNews } from '@/lib/use-has-news';

import { SubscribeForm } from './SubscribeForm';
import styles from './Footer.module.css';

export function Footer() {
  const socialLinks = getVisibleSocialLinks();
  const hasNews = useHasNews();
  const currentYear = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <Container>
        <div className={styles.columns}>
          <div>
            <Logo inverse />
            <p className={styles.tagline}>{TAGLINE}</p>
          </div>

          {APP_CONFIG.features.subscribe && (
            <div>
              <h2 className={styles.heading}>{SUBSCRIBE.heading}</h2>
              <p className={styles.text}>{SUBSCRIBE.blurb}</p>
              <SubscribeForm />
            </div>
          )}

          <div>
            <h2 className={styles.heading}>{FOOTER.contactHeading}</h2>
            <p className={styles.text}>
              <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>
            </p>
            {BUSINESS.phone && (
              <p className={styles.text}>
                <a href={`tel:${BUSINESS.phoneDial}`}>{BUSINESS.phone}</a>
              </p>
            )}
            <p className={styles.text}>{FOOTER.location}</p>

            {socialLinks.length > 0 && (
              <>
                <h2 className={styles.heading}>{FOOTER.followHeading}</h2>
                <ul className={styles.social} aria-label={A11Y.socialLinks}>
                  {socialLinks.map((link) => (
                    <li key={link.platform}>
                      <a href={link.url} target="_blank" rel="noopener noreferrer">
                        {SOCIAL_LABELS[link.platform]}
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>

        <div className={styles.bottom}>
          <span>{FOOTER.copyright(currentYear)}</span>
          <span className={styles.legal}>
            {hasNews && <a href={ROUTES.posts}>{FOOTER.newsLink}</a>}
            <a href={ROUTES.resources}>{RESOURCES.footerLink}</a>
            <a href={ROUTES.careers}>{CAREERS.footerLink}</a>
            <a href={ROUTES.privacy}>{FOOTER.privacyLink}</a>
            {APP_CONFIG.features.portal && <a href={PORTAL_ROUTES.login}>{FOOTER_PORTAL.signIn}</a>}
          </span>
        </div>
        <p className={styles.disclaimer}>{FOOTER.disclaimer}</p>
      </Container>
    </footer>
  );
}
