// @level infrastructure
// Roadkeeper — a time limit for work that grows with its files: a floor and an allowance a file, the count its caller
// gives, never past TIMER_MAX; and what a call stopped at its bound says.

// milliseconds of the longest timer node keeps: one longer fires at once
const TIMER_MAX = 2 ** 31 - 1;

// The bound in milliseconds for `floor` and `perFile` milliseconds a file at `count` files, a part of a millisecond
// rounded up, TIMER_MAX at most; the floor alone when `count` is null. `limit`: { floor, perFile }.
export const limitFor = ({ floor, perFile }, count) => Math.min(floor + Math.ceil(perFile * (count ?? 0)), TIMER_MAX);

// What a call that ran out of its `bound` milliseconds says, after its name.
export const ranOut = (bound) => `took longer than its ${Math.round(bound / 1000)} s`;

// What stopped the call `name` bounded at `bound` milliseconds: its bound when it ran out, else that it failed.
export const callStopped = (name, bound, error) => `${name} ${error?.code === "ETIMEDOUT" ? ranOut(bound) : "failed"}`;
