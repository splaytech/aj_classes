import userEvent, { type UserEvent } from '@testing-library/user-event';

/**
 * A user-event session for one test. `delay: null` sends all the keystrokes of one `type` call
 * without a timer between them. With the default delay, each keystroke waits on a timer, so a
 * test that times out on a stalled CI machine keeps typing after it has ended, into whatever
 * field the next test has focused. Seen in `act`: the AC-4.4 phone test found "9 999", the tail
 * of the previous test's "0499 999 999". Assertions are unchanged.
 */
export function setupUser(): UserEvent {
  return userEvent.setup({ delay: null });
}
