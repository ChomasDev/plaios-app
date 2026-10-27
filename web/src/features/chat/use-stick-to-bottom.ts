import { useCallback, useLayoutEffect, useRef } from "react";

const RELEASE_DISTANCE = 48;

/** Follows new content only while the reader is at the bottom; scrolling up releases the follow. */
export function useStickToBottom(resetKey: unknown) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const stuck = useRef(true);

  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    const content = contentRef.current;
    if (!scroller || !content) return;
    const follow = () => { if (stuck.current) scroller.scrollTop = scroller.scrollHeight; };
    const observer = new ResizeObserver(follow);
    observer.observe(content);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    stuck.current = true;
    const scroller = scrollRef.current;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }, [resetKey]);

  const onScroll = useCallback(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    stuck.current = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < RELEASE_DISTANCE;
  }, []);
  const stick = useCallback(() => { stuck.current = true; }, []);
  const release = useCallback(() => { stuck.current = false; }, []);

  return { scrollRef, contentRef, onScroll, stick, release };
}
