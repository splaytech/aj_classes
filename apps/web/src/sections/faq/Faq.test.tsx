import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FAQ } from '@/constants';

import { Faq } from './Faq';

describe('Faq', () => {
  it('shows every question from the content constants', () => {
    render(<Faq />);
    for (const item of FAQ.items) {
      expect(screen.getByText(item.question)).toBeInTheDocument();
    }
  });
});
