import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

/**
 * Minimal surface primitive. Future shared UI lives in this directory
 * (Button, Tabs, Modal, Input, Table, ...).
 */
export function Card({ children, className = "" }: Props) {
  return (
    <div className={`border border-navy/10 bg-white ${className}`}>
      {children}
    </div>
  );
}
