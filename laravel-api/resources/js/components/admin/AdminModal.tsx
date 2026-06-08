import { useEffect, useId, type FormHTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface AdminModalProps {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg';
  formProps?: FormHTMLAttributes<HTMLFormElement>;
}

export default function AdminModal({
  title,
  onClose,
  children,
  footer,
  size = 'md',
  formProps,
}: AdminModalProps) {
  const titleId = useId();

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  const modalClass = size === 'lg' ? 'admin-modal admin-modal-lg' : 'admin-modal';
  const content = (
    <>
      {children}
      {footer && <div className="admin-modal-footer">{footer}</div>}
    </>
  );

  return createPortal(
    <div className="admin-modal-overlay" onMouseDown={onClose}>
      <section
        className={modalClass}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="admin-modal-header">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="admin-modal-close" onClick={onClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        {formProps ? (
          <form {...formProps} className="admin-modal-body">
            {content}
          </form>
        ) : (
          <div className="admin-modal-body">{content}</div>
        )}
      </section>
    </div>,
    document.body,
  );
}
