# slot-machine

A responsive, configurable React slot machine / reel component. Use one component per reel; combine multiple reels for a full slot grid. No external UI or state library required—bring your own items and styling.

## Install

```bash
npm install slot-machine
# or
yarn add slot-machine
pnpm add slot-machine
```

## Peer dependencies

- `react` >= 18
- `react-dom` >= 18

## Basic usage

```tsx
import { SlotMachine, type SlotItem, type SlotMachineHandle } from "slot-machine";
import { useRef } from "react";

const items: SlotItem[] = [
  { id: "1", image: "/cherry.png", name: "Cherry" },
  { id: "2", image: "/lemon.png", name: "Lemon" },
  { id: "3", image: "/seven.png", name: "Seven" },
];

function App() {
  const ref = useRef<SlotMachineHandle>(null);

  return (
    <div style={{ width: "100%", height: "400px" }}>
      <SlotMachine
        ref={ref}
        items={items}
        onSpinEnd={(result) => console.log("Landed on", result)}
      />
      <button onClick={() => ref.current?.spin()}>Spin</button>
    </div>
  );
}
```

## Multiple reels (slot count)

Render one `SlotMachine` per reel and control spin via refs:

```tsx
const SLOT_COUNT = 6;
const refs = useRef<(SlotMachineHandle | null)[]>([]);

<div style={{ display: "flex", gap: 8, width: "100%", height: 450 }}>
  {Array.from({ length: SLOT_COUNT }).map((_, i) => (
    <div key={i} style={{ flex: 1, minWidth: 0 }}>
      <SlotMachine
        ref={(r) => { refs.current[i] = r; }}
        items={items}
        slotIndex={i}
        forcedResult={serverResults[i]} // optional: fix outcome per reel
        onSpinEnd={(result) => handleReelEnd(i, result)}
      />
    </div>
  ))}
</div>
<button onClick={() => refs.current.forEach((r) => r?.spin())}>
  Spin all
</button>
```

## Props (input data & settings)

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `items` | `T[]` | required | Pool of items for the reel (and optional forced result). |
| `slotIndex` | `number` | `0` | Index of this reel (e.g. 0..5 for 6 reels). |
| `forcedResult` | `T \| null` | `null` | If set, this reel stops on this item (e.g. from server). |
| `duration` | `number` | `2500` | Spin duration in ms. |
| `twistDuration` | `number` | `400` | Twist-back (snap to center) duration in ms. |
| `orientation` | `"vertical" \| "horizontal"` | `"vertical"` | Reel direction. |
| `itemSize` | `number` | derived | Item size in px. Omit for responsive (size from container). |
| `itemGap` | `number` | `20` | Gap around each item in px. |
| `reelItemCount` | `number` | `35` | Number of items in the reel (longer = longer spin feel). |
| `forcedTargetIndex` | `number` | `30` | Index in reel where `forcedResult` is placed. |
| `onSpinStart` | `() => void` | - | Called when spin starts. |
| `onSpinEnd` | `(result: T) => void` | - | Called when reel stops with selected item. |
| `renderItem` | `(item, options) => ReactNode` | - | Custom render per item (see below). |
| `itemClassName` | `string` | - | Class for default item wrapper. |
| `itemStyle` | `CSSProperties` | - | Style for default item wrapper. |
| `className` | `string` | - | Root wrapper class. |
| `style` | `CSSProperties` | - | Root wrapper style. |
| `overlayGradient` | `"none" \| "top-bottom" \| "left-right"` | auto | Fade overlay; default by orientation. |
| `placeholderImage` | `string` | `""` | Image URL when item has no image. |
| `getItemImage` | `(item: T) => string` | `item => item.image` | Resolve image URL from item. |
| `getItemName` | `(item: T) => string` | `item => item.name` | Resolve name (e.g. alt text). |

## Custom item style

- **Simple:** use `itemClassName` and `itemStyle` to style the default image wrapper.
- **Full control:** use `renderItem` to render each cell yourself. You receive `(item, { isCenter, index, centerScale })` and return any `ReactNode`. The component handles position and animation; you control content and style.

```tsx
<SlotMachine
  items={items}
  itemClassName="rounded-lg shadow-md"
  itemStyle={{ border: "2px solid gold" }}
/>
```

```tsx
<SlotMachine
  items={items}
  renderItem={(item, { isCenter, centerScale }) => (
    <div style={{ transform: `scale(${isCenter ? centerScale : 1})` }}>
      <img src={item.image} alt={item.name} />
      {isCenter && <span className="badge">Selected</span>}
    </div>
  )}
/>
```

## Responsive behavior

- Root wrapper is `width: 100%`, `height: 100%`, and uses `containerType: "size"` so you can size it from a parent (e.g. flex, grid, or fixed height).
- If you don’t pass `itemSize`, the component uses a default and adjusts with container size (ResizeObserver). For full control, pass `itemSize` from your own breakpoints or layout.

Example: full-width row of reels that scales with viewport:

```tsx
<div className="slot-grid" style={{
  display: "flex",
  gap: "clamp(4px, 1vw, 16px)",
  width: "100%",
  height: "clamp(200px, 40vmin, 450px)",
}}>
  {reels.map((_, i) => (
    <div key={i} style={{ flex: 1, minWidth: 0 }}>
      <SlotMachine items={items} />
    </div>
  ))}
</div>
```

## Types

- **SlotItem**: `{ id: string; image: string; name?: string; [key: string]: unknown }`. Extend this in your app (e.g. add `price`, `rarity`).
- **SlotMachineHandle**: `{ spin: () => void }` for imperative spin.
- **SlotMachineProps&lt;T&gt;**: props type; `T` must extend `SlotItem`.
- **SlotItemRenderOptions**: `{ isCenter: boolean; index: number; centerScale: number }` passed to `renderItem`.

## License

MIT
