import Maha.CanonicalArithmetic

/-
  Angle normalization and separation.

  Angles are integer millidegrees, matching the kernel's fixed-point ABI: a full
  circle is 360000. Working in exact integers avoids any claim about
  floating-point behaviour.

  These theorems are about the arithmetic of angle representatives. They make no
  claim about celestial mechanics, ephemeris accuracy, or the meaning of any
  angular quantity.
-/

namespace Maha
namespace Angle

/-- A full circle in millidegrees. -/
def fullCircle : Int := 360000

/-- A half circle in millidegrees. -/
def halfCircle : Int := 180000

theorem fullCircle_pos : 0 < fullCircle := by decide

/-- Normalization maps any angle to its representative in `[0, fullCircle)`. -/
def normalize (a : Int) : Int := a % fullCircle

/-- A normalized angle is never negative. -/
theorem normalize_nonneg (a : Int) : 0 ≤ normalize a :=
  Int.emod_nonneg a (by decide)

/-- A normalized angle is strictly below a full circle. -/
theorem normalize_lt (a : Int) : normalize a < fullCircle :=
  Int.emod_lt_of_pos a fullCircle_pos

/-- Normalized angles fall within the declared full-circle interval. -/
theorem normalize_mem (a : Int) : 0 ≤ normalize a ∧ normalize a < fullCircle :=
  ⟨normalize_nonneg a, normalize_lt a⟩

/-- Normalization is idempotent. -/
theorem normalize_idempotent (a : Int) : normalize (normalize a) = normalize a :=
  Int.emod_eq_of_lt (normalize_nonneg a) (normalize_lt a)

/--
  Angular separation: the shorter of the two arcs between two angles.

  `min` over the normalized difference and its complement.
-/
def separation (a b : Int) : Int :=
  let d := normalize (a - b)
  min d (fullCircle - d)

/-- Separation is bounded below by zero. -/
theorem separation_nonneg (a b : Int) : 0 ≤ separation a b := by
  have hd : 0 ≤ normalize (a - b) := normalize_nonneg _
  have hc : normalize (a - b) < fullCircle := normalize_lt _
  simp only [separation]
  omega

/-- Angular separation never exceeds half a circle. -/
theorem separation_le_half (a b : Int) : separation a b ≤ halfCircle := by
  have hd : 0 ≤ normalize (a - b) := normalize_nonneg _
  have hc : normalize (a - b) < fullCircle := normalize_lt _
  -- Both constants must be literals here: the bound depends on the numeric
  -- relation between a full and a half circle, not just on their names.
  simp only [separation, halfCircle, fullCircle] at *
  omega

end Angle
end Maha
