// Buttons and button-styled links. Two looks: "primary" (filled) and "secondary" (outlined).

import type { ReactNode } from 'react';

import styles from './Button.module.css';

type Variant = 'primary' | 'secondary';

function classNameFor(variant: Variant): string {
  return `${styles.button} ${styles[variant]}`;
}

type ButtonProps = {
  children: ReactNode;
  variant?: Variant;
  type?: 'button' | 'submit';
  disabled?: boolean;
  onClick?: () => void;
};

export function Button({
  children,
  variant = 'primary',
  type = 'button',
  disabled,
  onClick,
}: ButtonProps) {
  return (
    <button className={classNameFor(variant)} type={type} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

type ButtonLinkProps = {
  children: ReactNode;
  href: string;
  variant?: Variant;
  onClick?: () => void;
};

export function ButtonLink({ children, href, variant = 'primary', onClick }: ButtonLinkProps) {
  return (
    <a className={classNameFor(variant)} href={href} onClick={onClick}>
      {children}
    </a>
  );
}
