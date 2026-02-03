"use client";

import {
  useState,
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useMemo,
  useCallback,
} from "react";
import type { SlotItem, SlotMachineHandle, SlotMachineProps } from "./types";

const DEFAULT_REEL_ITEMS = 35;
const DEFAULT_FORCED_TARGET_INDEX = 30;
const STOP_OFFSET_RATIO = 0.49;

function defaultGetItemImage(item: SlotItem): string {
  return item.image ?? "";
}
function defaultGetItemName(item: SlotItem): string {
  return item.name ?? "Item";
}

function SlotMachineInner<T extends SlotItem>(
  {
    items: itemsPool,
    slotIndex = 0,
    forcedResult = null,
    duration = 2500,
    twistDuration = 400,
    orientation = "vertical",
    itemSize: propItemSize,
    itemGap = 20,
    reelItemCount = DEFAULT_REEL_ITEMS,
    forcedTargetIndex = DEFAULT_FORCED_TARGET_INDEX,
    onSpinStart,
    onSpinEnd,
    renderItem,
    itemClassName,
    itemStyle,
    className,
    style,
    overlayGradient,
    placeholderImage = "",
    getItemImage = defaultGetItemImage,
    getItemName = defaultGetItemName,
  }: SlotMachineProps<T>,
  ref: React.ForwardedRef<SlotMachineHandle>
) {
  const isVertical = orientation === "vertical";
  const [isSpinning, setIsSpinning] = useState(false);
  const isSpinningRef = useRef(false);
  const spinTokenRef = useRef(0);
  const completedTokenRef = useRef<number | null>(null);
  const spinStartedAtRef = useRef<number>(0);
  const [translateY, setTranslateY] = useState(0);
  const [translateX, setTranslateX] = useState(0);
  const [items, setItems] = useState<T[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const twistFinishTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const preloadedImagesRef = useRef<Set<string>>(new Set());
  const rafTickRef = useRef(0);
  const [measuredSize, setMeasuredSize] = useState(0);

  const forcedBaseCount = forcedTargetIndex + 1;
  const forcedTailCount = reelItemCount - forcedBaseCount;

  const itemSize =
    propItemSize ?? (isVertical ? Math.min(measuredSize || 80, 80) : Math.min(measuredSize || 160, 160));
  const itemTotal = itemSize + itemGap * 2;
  const centerOffset = -itemSize / 2;

  const pickRandom = useCallback((): T => {
    if (itemsPool.length === 0) {
      return {
        id: "",
        image: placeholderImage,
        name: "",
      } as T;
    }
    const i = Math.floor(Math.random() * itemsPool.length);
    return itemsPool[i];
  }, [itemsPool, placeholderImage]);

  const generateItems = useCallback(
    (count: number): T[] => {
      const out: T[] = [];
      for (let i = 0; i < count; i++) out.push(pickRandom());
      return out;
    },
    [pickRandom]
  );

  const preloadImages = useCallback((list: T[]) => {
    list.forEach((item) => {
      const url = getItemImage(item) || item.image;
      if (url && !preloadedImagesRef.current.has(url)) {
        const img = new window.Image();
        img.src = url;
        preloadedImagesRef.current.add(url);
      }
    });
  }, [getItemImage]);

  useEffect(() => {
    if (itemsPool.length > 0) {
      const initial = generateItems(reelItemCount);
      setItems(initial);
      preloadImages(initial);
      setTranslateX(0);
      setTranslateY(0);
    }
  }, [itemsPool.length, reelItemCount, isVertical]);

  const lastMeasuredRef = useRef(0);
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0]?.contentRect ?? { width: 0, height: 0 };
      const size = isVertical ? height : width;
      const suggested = Math.max(40, Math.min(size ? Math.floor(size / 3) : 80, isVertical ? 80 : 160));
      if (suggested !== lastMeasuredRef.current) {
        lastMeasuredRef.current = suggested;
        setMeasuredSize(suggested);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [isVertical]);

  const spin = useCallback(() => {
    if (isSpinningRef.current || itemsPool.length === 0) return;

    isSpinningRef.current = true;
    completedTokenRef.current = null;
    spinStartedAtRef.current =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    setIsSpinning(true);
    onSpinStart?.();

    if (animationFrameRef.current != null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    rafTickRef.current = 0;
    [startTimeoutRef, finishTimeoutRef, twistFinishTimeoutRef].forEach((r) => {
      if (r.current != null) {
        clearTimeout(r.current);
        r.current = null;
      }
    });

    const spinToken = ++spinTokenRef.current;
    if (isVertical) setTranslateY(0);
    else setTranslateX(0);
    const startTranslate = 0;

    const forced = forcedResult ?? null;
    const isForced = Boolean(forced);

    let updatedItems: T[];
    if (isForced) {
      const base = generateItems(forcedBaseCount);
      const tail = generateItems(forcedTailCount);
      base[forcedTargetIndex] = forced as T;
      updatedItems = [...base, ...tail];
      preloadImages([forced as T]);
      preloadImages(updatedItems);
    } else {
      updatedItems = generateItems(reelItemCount);
      preloadImages(updatedItems);
    }

    setItems(updatedItems);

    const totalItemsCount = updatedItems.length;
    const centerIndex = Math.floor(totalItemsCount / 2);
    const targetIndex = isForced ? forcedTargetIndex : totalItemsCount - 5;
    const itemsToMove = targetIndex - centerIndex;
    const moveDistance = itemsToMove * itemTotal;
    const perfectTargetTranslate = startTranslate - moveDistance;
    const randomOffset =
      (Math.random() - 0.5) * 2 * itemTotal * STOP_OFFSET_RATIO;
    const targetTranslate = perfectTargetTranslate + randomOffset;

    const minMs = duration + twistDuration;

    const completeOnce = (selectedIndex: number) => {
      if (spinToken !== spinTokenRef.current) return;
      if (completedTokenRef.current === spinToken) return;
      const now =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      const elapsed = now - spinStartedAtRef.current;
      if (elapsed < minMs) {
        const remaining = Math.max(0, Math.ceil(minMs - elapsed));
        finishTimeoutRef.current = setTimeout(
          () => completeOnce(selectedIndex),
          remaining
        );
        return;
      }
      completedTokenRef.current = spinToken;
      if (
        selectedIndex >= 0 &&
        selectedIndex < updatedItems.length
      ) {
        onSpinEnd?.(updatedItems[selectedIndex]);
      }
      isSpinningRef.current = false;
      setIsSpinning(false);
    };

    startTimeoutRef.current = setTimeout(() => {
      const startTime = Date.now();

      const animate = () => {
        if (spinToken !== spinTokenRef.current) return;
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = 1 - Math.pow(1 - progress, 3);
        const currentTranslateValue =
          startTranslate +
          (targetTranslate - startTranslate) * easedProgress;

        if (containerRef.current) {
          containerRef.current.style.transform = isVertical
            ? `translateY(${currentTranslateValue}px)`
            : `translateX(${currentTranslateValue}px)`;
        }
        rafTickRef.current += 1;
        if (rafTickRef.current % 2 === 0) {
          if (isVertical) setTranslateY(currentTranslateValue);
          else setTranslateX(currentTranslateValue);
        }

        if (progress < 1) {
          animationFrameRef.current = requestAnimationFrame(animate);
        } else {
          let clampedClosestIndex: number;
          if (isForced) {
            clampedClosestIndex = Math.max(
              0,
              Math.min(forcedTargetIndex, updatedItems.length - 1)
            );
          } else {
            const closestIndexFloat =
              centerIndex - targetTranslate / itemTotal;
            const closestIndex = Math.round(closestIndexFloat);
            clampedClosestIndex = Math.max(
              0,
              Math.min(closestIndex, updatedItems.length - 1)
            );
          }

          const itemOffsetFromCenter =
            (clampedClosestIndex - centerIndex) * itemTotal;
          const perfectPositionForClosestItem = -itemOffsetFromCenter;
          const offsetToPerfect =
            perfectPositionForClosestItem - targetTranslate;

          const twistBackStartTime = Date.now();
          const twistBackStartPosition = targetTranslate;

          const animateTwistBack = () => {
            if (spinToken !== spinTokenRef.current) return;
            const twistBackElapsed = Date.now() - twistBackStartTime;
            const twistBackProgress = Math.min(
              twistBackElapsed / twistDuration,
              1
            );
            const twistBackEased = 1 - Math.pow(1 - twistBackProgress, 3);
            const twistBackCurrentPosition =
              twistBackStartPosition + offsetToPerfect * twistBackEased;

            if (containerRef.current) {
              containerRef.current.style.transform = isVertical
                ? `translateY(${twistBackCurrentPosition}px)`
                : `translateX(${twistBackCurrentPosition}px)`;
            }
            rafTickRef.current += 1;
            if (rafTickRef.current % 2 === 0) {
              if (isVertical) setTranslateY(twistBackCurrentPosition);
              else setTranslateX(twistBackCurrentPosition);
            }

            if (twistBackProgress < 1) {
              animationFrameRef.current =
                requestAnimationFrame(animateTwistBack);
            } else {
              if (isVertical) setTranslateY(twistBackCurrentPosition);
              else setTranslateX(twistBackCurrentPosition);
              twistFinishTimeoutRef.current = setTimeout(() => {
                completeOnce(clampedClosestIndex);
              }, 50);
            }
          };

          animationFrameRef.current = requestAnimationFrame(animateTwistBack);
        }
      };

      animationFrameRef.current = requestAnimationFrame(animate);
    }, 0);
  }, [
    itemsPool.length,
    forcedResult,
    duration,
    twistDuration,
    isVertical,
    reelItemCount,
    forcedTargetIndex,
    forcedBaseCount,
    forcedTailCount,
    itemTotal,
    generateItems,
    preloadImages,
    onSpinStart,
    onSpinEnd,
  ]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current != null)
        cancelAnimationFrame(animationFrameRef.current);
      [startTimeoutRef, finishTimeoutRef, twistFinishTimeoutRef].forEach(
        (r) => {
          if (r.current != null) clearTimeout(r.current);
        }
      );
      completedTokenRef.current = null;
      isSpinningRef.current = false;
    };
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      spin,
    }),
    [spin]
  );

  const getItemPosition = (index: number, centerIndex: number) =>
    (index - centerIndex) * itemTotal;

  const closestToCenterIndex = useMemo(() => {
    if (items.length === 0) return 0;
    const centerIndex = Math.floor(items.length / 2);
    const currentTranslate = isVertical ? translateY : translateX;
    const closestIndexFloat = centerIndex - currentTranslate / itemTotal;
    const closestIndex = Math.round(closestIndexFloat);
    return Math.max(0, Math.min(closestIndex, items.length - 1));
  }, [items.length, translateY, translateX, isVertical, itemTotal]);

  const centerScale = 1.5;

  const defaultRenderItem = useCallback(
    (item: T, index: number) => {
      const isCenterItem = index === closestToCenterIndex;
      const scale = isCenterItem ? centerScale : 1;
      const imageUrl = getItemImage(item) || item.image || placeholderImage;
      const name = getItemName(item) || "Item";

      return (
        <div
          key={`item-${index}-${item.id ?? index}`}
          className={itemClassName}
          style={{
            position: "absolute",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: itemSize,
            height: itemSize,
            minWidth: itemSize,
            minHeight: itemSize,
            maxWidth: itemSize,
            maxHeight: itemSize,
            left: "50%",
            top: "50%",
            transform: isVertical
              ? `translate(${centerOffset}px, ${getItemPosition(index, Math.floor(items.length / 2)) + centerOffset}px)`
              : `translate(${getItemPosition(index, Math.floor(items.length / 2)) + centerOffset}px, ${centerOffset}px)`,
            boxSizing: "border-box",
            ...itemStyle,
          }}
        >
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "55%",
              height: "55%",
              transform: `scale(${scale})`,
              transition: "transform 80ms linear",
            }}
          >
            <img
              src={imageUrl}
              alt={name}
              width={itemSize}
              height={itemSize}
              loading="eager"
              style={{
                width: itemSize,
                height: itemSize,
                objectFit: "contain",
                display: "block",
              }}
            />
          </div>
        </div>
      );
    },
    [
      items.length,
      isVertical,
      itemTotal,
      closestToCenterIndex,
      itemSize,
      centerOffset,
      itemClassName,
      itemStyle,
      getItemImage,
      getItemName,
      placeholderImage,
    ]
  );

  const showOverlay =
    overlayGradient !== "none" &&
    (overlayGradient ?? (isVertical ? "top-bottom" : "left-right"));

  const rootStyle: React.CSSProperties = {
    position: "relative",
    width: "100%",
    height: "100%",
    minHeight: isVertical ? 300 : 120,
    boxSizing: "border-box",
    overflow: "hidden",
    ...style,
    containerType: "size",
  };

  return (
    <div
      ref={wrapperRef}
      className={className}
      style={rootStyle}
    >
      {showOverlay === "top-bottom" && (
        <>
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              height: "30%",
              background:
                "linear-gradient(to bottom, var(--slot-overlay-from, rgba(0,0,0,0.6)), transparent)",
              zIndex: 10,
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: "30%",
              background:
                "linear-gradient(to top, var(--slot-overlay-from, rgba(0,0,0,0.6)), transparent)",
              zIndex: 10,
              pointerEvents: "none",
            }}
          />
        </>
      )}
      {showOverlay === "left-right" && (
        <>
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              width: "30%",
              background:
                "linear-gradient(to right, var(--slot-overlay-from, rgba(0,0,0,0.6)), transparent)",
              zIndex: 10,
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              right: 0,
              width: "30%",
              background:
                "linear-gradient(to left, var(--slot-overlay-from, rgba(0,0,0,0.6)), transparent)",
              zIndex: 10,
              pointerEvents: "none",
            }}
          />
        </>
      )}

      {items.length > 0 ? (
        <div
          ref={containerRef}
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            transform: isVertical
              ? `translateY(${translateY}px)`
              : `translateX(${translateX}px)`,
            transition: isSpinning
              ? "none"
              : "transform 800ms cubic-bezier(0.34, 1.56, 0.64, 1)",
            willChange: isSpinning ? "transform" : "auto",
          }}
        >
          {items.map((item, index) => {
            const centerIndex = Math.floor(items.length / 2);
            const position = getItemPosition(index, centerIndex);
            const isCenterItem = index === closestToCenterIndex;

            if (renderItem) {
              return (
                <div
                  key={`item-${index}-${item.id ?? index}`}
                  style={{
                    position: "absolute",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: itemSize,
                    height: itemSize,
                    minWidth: itemSize,
                    minHeight: itemSize,
                    left: "50%",
                    top: "50%",
                    transform: isVertical
                      ? `translate(${centerOffset}px, ${position + centerOffset}px)`
                      : `translate(${position + centerOffset}px, ${centerOffset}px)`,
                  }}
                >
                  {renderItem(item, {
                    isCenter: isCenterItem,
                    index,
                    centerScale,
                  })}
                </div>
              );
            }
            return defaultRenderItem(item, index);
          })}
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "100%",
            color: "var(--slot-empty-text, #888)",
          }}
        >
          <span>Loading items...</span>
        </div>
      )}
    </div>
  );
}

const SlotMachine = forwardRef(SlotMachineInner) as <T extends SlotItem>(
  props: SlotMachineProps<T> & { ref?: React.ForwardedRef<SlotMachineHandle> }
) => React.ReactElement;

export { SlotMachine };
