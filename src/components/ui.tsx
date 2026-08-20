import { ReactNode, useEffect, ReactElement } from "react";

export function PageHeader({
  icon,
  title,
  subtitle,
  children
}: {
  icon: string;
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <div className="ui-page-header">
      <div>
        <h1 className="ui-title">
          <i className={`bi ${icon} text-warning`} /> {title}
        </h1>
        {subtitle ? <div className="ui-subtitle">{subtitle}</div> : null}
      </div>
      <div className="ui-toolbar">{children}</div>
    </div>
  );
}

export function Card({
  title,
  icon,
  extra,
  flush,
  children
}: {
  title?: string;
  icon?: string;
  extra?: ReactNode;
  flush?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="ui-card mb-4">
      {title ? (
        <div className="ui-card-header">
          <h5>
            {icon ? <i className={`bi ${icon} text-warning`} /> : null}
            {title}
          </h5>
          {extra}
        </div>
      ) : null}
      <div className={flush ? "ui-card-body flush" : "ui-card-body"}>{children}</div>
    </div>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  size = "md"
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const sizeClass = size === "full" ? "modal-fullscreen" : size === "xl" ? "modal-xl" : size === "lg" ? "modal-lg" : size === "sm" ? "modal-sm" : "";

  return (
    <>
      <div className="modal fade show d-block" tabIndex={-1} style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
        <div className={`modal-dialog ${sizeClass} modal-dialog-centered modal-dialog-scrollable`}>
          <div className="modal-content border-secondary" style={{ background: "#1e293b" }}>
            <div className="modal-header border-0">
              <h5 className="modal-title text-warning fw-bold">{title}</h5>
              <button type="button" className="btn-close btn-close-white" onClick={onClose} />
            </div>
            <div className="modal-body text-start">{children}</div>
            {footer && <div className="modal-footer border-0">{footer}</div>}
          </div>
        </div>
      </div>
    </>
  );
}

export function Sheet({
  open,
  title,
  onClose,
  wide,
  children,
  footer
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  wide?: boolean;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <aside className={`sheet ${wide ? "wide" : ""}`} role="dialog">
        <div className="ui-sheet-header">
          <h5 className="mb-0 fw-bold">{title}</h5>
          <button className="btn btn-sm btn-outline-secondary" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="ui-sheet-body">{children}</div>
        {footer ? <div className="ui-sheet-footer">{footer}</div> : null}
      </aside>
    </>
  );
}

export function Field({
  label,
  children
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="ui-field mb-3">
      <label className="ui-label">{label}</label>
      {children}
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return <div className="ui-empty py-4">{text}</div>;
}

export { Combobox } from "./Combobox";
export type { ComboboxOption, ComboboxProps } from "./Combobox";
