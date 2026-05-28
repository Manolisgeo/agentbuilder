import { useRef } from "react";

/** Keep iframe HTML frozen while inactive to avoid hidden reloads during edits. */
export function useDeferredHtml(
  html: string | null,
  isActive: boolean
): string | null {
  const deferredRef = useRef(html);

  if (isActive) {
    deferredRef.current = html;
  }

  return isActive ? html : deferredRef.current;
}
