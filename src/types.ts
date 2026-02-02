import type { CSSProperties, ReactNode } from "react";

/**
 * Minimal item shape for the slot reel. Extend this type for your app (e.g. add price, rarity).
 */
export interface SlotItem {
  id: string;
  image: string;
  name?: string;
  [key: string]: unknown;
}

/**
 * Orientation of the reel.
 */
export type SlotOrientation = "vertical" | "horizontal";

/**
 * Options passed to a custom renderItem function.
 */
export interface SlotItemRenderOptions {
  /** Whether this item is currently centered in the viewport */
  isCenter: boolean;
  /** Index in the reel */
  index: number;
  /** Scale applied to center item (e.g. 1.5); use for your own styling */
  centerScale: number;
}

/**
 * Props for the SlotMachine component (single reel).
 */
export interface SlotMachineProps<T extends SlotItem = SlotItem> {
  /** Pool of items to pick from for random fill and for forced result */
  items: T[];
  /** Which reel this is (0-based), e.g. 0..5 for 6 reels */
  slotIndex?: number;
  /** Optional forced result for this reel (e.g. from server); if set, reel stops on this item */
  forcedResult?: T | null;
  /** Spin duration in ms */
  duration?: number;
  /** Twist-back (snap to center) duration in ms */
  twistDuration?: number;
  /** Orientation of the reel */
  orientation?: SlotOrientation;
  /** Item size in px (used for layout). Responsive: use state + ResizeObserver or CSS to drive this */
  itemSize?: number;
  /** Gap (margin) around each item in px */
  itemGap?: number;
  /** Total number of items in the reel (default 35). Higher = longer spin feel */
  reelItemCount?: number;
  /** Index where forced result is placed in the reel (default 30) */
  forcedTargetIndex?: number;
  /** Callback when spin starts */
  onSpinStart?: () => void;
  /** Callback when spin ends with the selected item */
  onSpinEnd?: (result: T) => void;
  /** Custom render for each item. If not provided, default image + optional itemStyle/itemClassName are used */
  renderItem?: (item: T, options: SlotItemRenderOptions) => ReactNode;
  /** Class name for each item wrapper (when not using renderItem) */
  itemClassName?: string;
  /** Inline style for each item wrapper (when not using renderItem) */
  itemStyle?: CSSProperties;
  /** Class name for the root wrapper */
  className?: string;
  /** Inline style for the root wrapper */
  style?: CSSProperties;
  /** Overlay gradient visibility: "none" | "top-bottom" | "left-right" (default "top-bottom" for vertical) */
  overlayGradient?: "none" | "top-bottom" | "left-right";
  /** Placeholder image URL when item.image is empty */
  placeholderImage?: string;
  /** Get image URL from item (default: item.image or item.template?.imageUrl) */
  getItemImage?: (item: T) => string;
  /** Get display name from item (default: item.name or item.template?.name) */
  getItemName?: (item: T) => string;
}

/**
 * Ref handle for imperative spin.
 */
export interface SlotMachineHandle {
  spin: () => void;
}
