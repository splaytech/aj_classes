// The in-person suburbs as part of a sentence ("Williams Landing, Truganina and Craigieburn"), each
// linking to its centre page so every programme page passes search engines a link to them
// (local-seo.md). Reads BUSINESS.suburbs, so the text always matches BUSINESS.suburbsText.

import { Fragment } from 'react';

import { BUSINESS, centrePathFor } from '@/constants';

export function CentreLinks() {
  const last = BUSINESS.suburbs.length - 1;
  return (
    <>
      {BUSINESS.suburbs.map((name, index) => {
        const path = centrePathFor(name);
        const separator = index === 0 ? '' : index === last ? ' and ' : ', ';
        return (
          <Fragment key={name}>
            {separator}
            {path ? <a href={path}>{name}</a> : name}
          </Fragment>
        );
      })}
    </>
  );
}
