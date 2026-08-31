/-
  Canonical arithmetic shared by the Maha formal bridge.

  The WASM kernel computes over signed 64-bit fixed-point values. These
  definitions model that arithmetic over `Int`, which is unbounded. That gap is
  deliberate and is stated in the informal boundary of every attachment: these
  theorems describe the intended arithmetic, not the overflow behaviour of the
  compiled kernel. Nothing here proves the kernel implements them.
-/

namespace Maha

/-- A closed interval over the integers, carrying no well-formedness proof. -/
structure Interval where
  lower : Int
  upper : Int
  deriving DecidableEq, Repr

namespace Interval

/-- An interval is valid when its bounds are ordered. -/
def Valid (i : Interval) : Prop := i.lower ≤ i.upper

/-- Membership: the reals are not in play, so a member is an integer in range. -/
def Mem (i : Interval) (x : Int) : Prop := i.lower ≤ x ∧ x ≤ i.upper

/-- Interval addition, bound-wise. This mirrors the kernel's `interval-add`. -/
def add (a b : Interval) : Interval :=
  { lower := a.lower + b.lower, upper := a.upper + b.upper }

/-- The additive identity interval. -/
def zero : Interval := { lower := 0, upper := 0 }

end Interval

end Maha
