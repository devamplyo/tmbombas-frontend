import { useEffect } from 'react';

// Popups can stack (a form Modal with a ConfirmSubmit on top), so the lock is counted:
// the page only scrolls again when the last popup closes.
let locks = 0;
let previous = { overflow: '', paddingRight: '' };

/** Keeps the page behind an open popup from scrolling (mouse wheel, touch, keyboard). */
export default function useScrollLock(active) {
  useEffect(() => {
    if (!active) return undefined;
    const body = document.body;
    if (locks === 0) {
      previous = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };
      // overflow: hidden removes the scrollbar; the padding stops the page from jumping sideways
      const scrollbar = window.innerWidth - document.documentElement.clientWidth;
      body.style.overflow = 'hidden';
      if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
    }
    locks += 1;
    return () => {
      locks -= 1;
      if (locks === 0) {
        body.style.overflow = previous.overflow;
        body.style.paddingRight = previous.paddingRight;
      }
    };
  }, [active]);
}
