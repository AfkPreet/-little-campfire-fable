/**
 * Shared UI event bus. The audio module subscribes here later (squish on press, a soft "nope" on disabled taps)
 * so widgets never import audio directly.
 */
import Phaser from 'phaser';

export const UI_EVENTS = {
  /** an enabled button was pressed (fires on pointerdown, with the squash) */
  press: 'ui:press',
  /** a disabled button was tapped: wobble, no action */
  nope: 'ui:nope',
  /** an action was picked from a bubble or a modal button */
  pick: 'ui:pick',
  /** a toast was shown */
  toast: 'ui:toast',
  /** a card/modal/bubble popped open */
  open: 'ui:open',
  /** a card/modal/bubble closed */
  close: 'ui:close',
  /** a toggle flipped (payload: boolean) */
  toggle: 'ui:toggle',
  /** a slider moved (payload: 0..1) */
  slide: 'ui:slide',
  /** a stepper changed (payload: number) */
  step: 'ui:step',
} as const;

export type UiEventName = (typeof UI_EVENTS)[keyof typeof UI_EVENTS];

export type UiEventPayload = {
  'ui:press': { kind: 'primary' | 'secondary' | 'icon'; label: string };
  'ui:nope': { label: string };
  'ui:pick': { label: string };
  'ui:toast': { message: string };
  'ui:open': { what: 'card' | 'modal' | 'bubble' | 'catch' };
  'ui:close': { what: 'card' | 'modal' | 'bubble' | 'catch' };
  'ui:toggle': { value: boolean; label?: string };
  'ui:slide': { value: number; label?: string };
  'ui:step': { value: number };
};

export const uiEvents = new Phaser.Events.EventEmitter();

/** Typed emit helper. */
export function emitUi<K extends UiEventName>(name: K, payload: UiEventPayload[K]): void {
  uiEvents.emit(name, payload);
}

/** Typed subscribe helper; returns an unsubscribe function. */
export function onUi<K extends UiEventName>(name: K, fn: (payload: UiEventPayload[K]) => void): () => void {
  uiEvents.on(name, fn);
  return () => uiEvents.off(name, fn);
}
