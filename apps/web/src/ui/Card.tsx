import type { HTMLAttributes } from 'react';
import styles from './Card.module.css';

/** A group of content set apart by a thin rule and space, not a box or a shadow. */
export function Card({
  as: Tag = 'div',
  className,
  ...rest
}: HTMLAttributes<HTMLElement> & { as?: 'div' | 'section' | 'aside' }) {
  return <Tag {...rest} className={[styles.card, className].filter(Boolean).join(' ')} />;
}
