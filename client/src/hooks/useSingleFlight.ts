import { useCallback, useLayoutEffect, useRef } from 'react';

export function useSingleFlight<Args extends unknown[]>(
  action: (...args: Args) => Promise<unknown>,
): (...args: Args) => void {
  const inFlight = useRef(false);
  const actionRef = useRef(action);

  useLayoutEffect(() => {
    actionRef.current = action;
  });

  return useCallback((...args: Args) => {
    if (inFlight.current) {
      return;
    }

    inFlight.current = true;
    void actionRef
      .current(...args)
      .catch((caught: unknown) => {
        console.error('Single-flight action failed:', caught);
      })
      .finally(() => {
        inFlight.current = false;
      });
  }, []);
}
