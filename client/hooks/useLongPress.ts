import { useCallback, useRef, useState } from 'react';

const useLongPress = (
  onLongPress: (e: any) => void,
  onClick: (e: any) => void,
  { shouldPreventDefault = true, delay = 600 } = {}
) => {
  const [longPressTriggered, setLongPressTriggered] = useState(false);
  const timeout = useRef<NodeJS.Timeout>();
  const target = useRef<EventTarget>();

  const start = useCallback(
    (e: any) => {
      if (shouldPreventDefault && e.target) {
        target.current = e.target;
      }
      setLongPressTriggered(false); // Reset
      timeout.current = setTimeout(() => {
        onLongPress(e);
        setLongPressTriggered(true);
      }, delay);
    },
    [onLongPress, delay, shouldPreventDefault]
  );

  const clear = useCallback(
    (e: any, shouldTriggerClick = true) => {
      timeout.current && clearTimeout(timeout.current);
      if (shouldTriggerClick && !longPressTriggered && onClick) {
        onClick(e);
      }
      setLongPressTriggered(false);
      target.current = undefined;
    },
    [shouldPreventDefault, onClick, longPressTriggered]
  );

  return {
    onMouseDown: (e: any) => start(e),
    onTouchStart: (e: any) => start(e),
    onMouseUp: (e: any) => clear(e),
    onMouseLeave: (e: any) => clear(e, false),
    onTouchEnd: (e: any) => clear(e)
  };
};

export default useLongPress;
