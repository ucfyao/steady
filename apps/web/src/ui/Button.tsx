import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'link' | 'danger';

type Common = {
  variant?: ButtonVariant;
  /** `lg`: the big, full-width call to action. */
  size?: 'md' | 'lg';
  children: ReactNode;
};

type AsButton = Common & ButtonHTMLAttributes<HTMLButtonElement> & { to?: undefined };
type AsLink = Common & LinkProps;

export type ButtonProps = AsButton | AsLink;

const classes = (variant: ButtonVariant, size: 'md' | 'lg', extra?: string) =>
  [styles.button, styles[variant], size === 'lg' && styles.lg, extra].filter(Boolean).join(' ');

/** A button, or a router link that looks like one when given `to`. */
export function Button(props: ButtonProps) {
  if (props.to !== undefined) {
    const { variant = 'primary', size = 'md', className, ...rest } = props;
    return <Link {...rest} className={classes(variant, size, className)} />;
  }
  const { variant = 'primary', size = 'md', className, type = 'button', ...rest } = props;
  return <button {...rest} type={type} className={classes(variant, size, className)} />;
}
