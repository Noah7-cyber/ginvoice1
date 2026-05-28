import { useRef, useEffect, useCallback } from 'react';

/**
 * A hook to index scrollable sections by their first letter (or other key)
 * and provide a smooth scrollTo method using scrollTop (not scrollIntoView).
 */
export const useAlphabetIndexer = (
  listRef: React.RefObject<HTMLElement>,
  dependency: any[]
) => {
  const sectionMap = useRef<Record<string, number>>({});

  const registerSections = useCallback(() => {
    if (!listRef.current) return;

    const newMap: Record<string, number> = {};
    const sections = listRef.current.querySelectorAll('[id^="section-"]');

    // Using offsetTop is safer than getBoundingClientRect for sticky elements
    // because offsetTop returns the position in the document flow, whereas
    // getBoundingClientRect returns the visual position (which might be "stuck").
    // We assume the listRef container is the offsetParent (it has position: relative).
    sections.forEach((section) => {
      if (section instanceof HTMLElement) {
        const id = section.id;
        const key = id.replace('section-', '');
        newMap[key] = section.offsetTop;
      }
    });

    sectionMap.current = newMap;
  }, [listRef]);

  // Re-register sections whenever dependencies change (e.g. filtered products update)
  useEffect(() => {
    // Small timeout to allow DOM to settle after render
    const t = setTimeout(registerSections, 100);
    return () => clearTimeout(t);
  }, [registerSections, ...dependency]);

  const scrollToLetter = useCallback((letter: string) => {
    if (!listRef.current) return;

    const map = sectionMap.current;
    let targetLetter = letter;

    // If the exact letter doesn't exist, find the next available one
    if (map[targetLetter] === undefined) {
       const sortedKeys = Object.keys(map).sort();
       // Find first key greater than targetLetter
       const nextKey = sortedKeys.find(key => key > targetLetter);

       if (nextKey) {
         targetLetter = nextKey;
       } else {
         // If no greater key, maybe scroll to the very end?
         // Or just scroll to the last available section.
         if (sortedKeys.length > 0) {
            targetLetter = sortedKeys[sortedKeys.length - 1];
         }
       }
    }

    if (map[targetLetter] !== undefined) {
      listRef.current.scrollTop = map[targetLetter];
    }
  }, [listRef]);

  return { scrollToLetter, registerSections };
};
