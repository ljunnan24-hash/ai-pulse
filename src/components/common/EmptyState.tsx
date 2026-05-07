import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

type Props = {
  title: string;
  description?: string;
  actionLabel?: string;
  actionTo?: string;
  /** primary：实心主按钮；secondary：描边 */
  actionVariant?: 'primary' | 'secondary';
  children?: ReactNode;
};

export function EmptyState({
  title,
  description,
  actionLabel,
  actionTo,
  actionVariant = 'primary',
  children,
}: Props) {
  const btnClass = actionVariant === 'secondary' ? 'btn-secondary' : 'btn-primary';

  return (
    <div className="card-surface px-5 py-10 text-center md:px-8 md:py-12">
      <div className="mx-auto max-w-md">
        <p className="font-headline text-base font-semibold text-slate-900">{title}</p>
        {description ? <p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p> : null}
        {children}
        {actionLabel && actionTo ? (
          <Link to={actionTo} className={`${btnClass} mt-6 inline-flex px-6 py-2.5 text-sm font-semibold no-underline`}>
            {actionLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
