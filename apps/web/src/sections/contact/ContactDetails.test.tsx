import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BUSINESS, BUSINESS_ADDRESS, CONTACT_DETAILS } from '@/constants';

import { ContactDetails } from './ContactDetails';

describe('ContactDetails', () => {
  it('shows the email, address, location and response time', () => {
    render(<ContactDetails />);
    expect(screen.getByRole('link', { name: BUSINESS.email })).toBeInTheDocument();
    expect(screen.getByText(BUSINESS_ADDRESS)).toBeInTheDocument();
    expect(screen.getByText(CONTACT_DETAILS.location)).toBeInTheDocument();
    expect(screen.getByText(CONTACT_DETAILS.response)).toBeInTheDocument();
  });

  it('shows the phone number as a link that dials it', () => {
    render(<ContactDetails />);
    const phone = screen.getByRole('link', { name: BUSINESS.phone ?? '' });
    expect(phone).toHaveAttribute('href', `tel:${BUSINESS.phoneDial}`);
  });

  it('hides the class hours row while the hours are not confirmed', () => {
    render(<ContactDetails />);
    expect(screen.queryByText(CONTACT_DETAILS.hoursLabel)).toBeNull();
  });
});
