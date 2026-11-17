// A Terms or Privacy link inside a form's tick box. Opens in a new tab so a half-filled form isn't
// lost. Plain text when the page doesn't exist (href null).

export function LegalLink({ href, children }: { href: string | null; children: string }) {
  if (!href) return <>{children}</>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}
