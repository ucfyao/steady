import type { HTMLAttributes } from 'react';
import styles from './Card.module.css';

/**
 * A panel (Spec 010): a group of content in a thin border, with no fill or shadow except on the
 * scene behind the page (Spec 028).
 */
export function Card({
  as: Tag = 'div',
  className,
  ...rest
}: HTMLAttributes<HTMLElement> & { as?: 'div' | 'section' | 'aside' }) {
  return <Tag {...rest} className={[styles.card, className].filter(Boolean).join(' ')} />;
}
