/**
 * Simple class name merger. Use with Tailwind or plain CSS.
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}
