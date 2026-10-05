import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BUSINESS, CONTACT_DETAILS } from '@/constants';

import { ContactDetails } from './ContactDetails';

describe('ContactDetails', () => {
  it('shows the email, location and response time', () => {
    render(<ContactDetails />);
    expect(screen.getByRole('link', { name: BUSINESS.email })).toBeInTheDocument();
    expect(screen.getByText(CONTACT_DETAILS.location)).toBeInTheDocument();
    expect(screen.getByText(CONTACT_DETAILS.response)).toBeInTheDocument();
  });

  it('hides the phone and class hours rows while they are not confirmed', () => {
    render(<ContactDetails />);
    expect(screen.queryByText(CONTACT_DETAILS.phoneLabel)).toBeNull();
    expect(screen.queryByText(CONTACT_DETAILS.hoursLabel)).toBeNull();
  });
});
