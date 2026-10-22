import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BUSINESS, WHATSAPP_BUTTON, WHATSAPP_GREETING, whatsappChatUrl } from '@/constants';

import { WhatsAppButton } from './WhatsAppButton';

describe('WhatsApp button', () => {
  it('opens a chat with the business number and a greeting already typed', () => {
    render(<WhatsAppButton />);
    const link = screen.getByRole('link', { name: WHATSAPP_BUTTON.ariaLabel });
    const url = new URL(link.getAttribute('href') ?? '');
    expect(url.origin).toBe('https://wa.me');
    expect(url.pathname).toBe(`/${BUSINESS.whatsappNumber}`);
    expect(url.searchParams.get('text')).toBe(WHATSAPP_GREETING);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('uses digits only for the number (wa.me needs no + or spaces)', () => {
    expect(BUSINESS.whatsappNumber).toMatch(/^\d{8,15}$/);
    expect(whatsappChatUrl()).not.toContain('+');
  });
});
