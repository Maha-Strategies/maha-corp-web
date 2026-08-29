import Maha.CanonicalArithmetic

/-
  An idealized one-dimensional steady-state conduction model.

  BOUNDARY. This file formalizes one textbook identity, R = L / (k A), and
  nothing else. It is a statement about arithmetic, not about any physical
  device. In particular it does NOT model or validate:

    * interface / contact resistance,
    * spreading resistance,
    * anisotropic conductivity,
    * radiation,
    * convection,
    * temperature-dependent conductivity,
    * transient behaviour.

  A proof here therefore establishes only that the idealized model has the sign
  behaviour claimed of it. It is not evidence that the model describes any real
  package, die, or measurement, and it must never be presented as thermal
  validation.

  The relation is stated multiplicatively (`R * (k * A) = L`) rather than with
  division. That keeps the statement in exact integer arithmetic and avoids
  asserting anything about rounding in a division implementation.
-/

namespace Maha
namespace Thermal

/--
  `Resistance R L k A` holds when `R` is the one-dimensional conduction
  resistance of a slab of thickness `L`, conductivity `k` and area `A`.
-/
def Resistance (R L k A : Int) : Prop := R * (k * A) = L

/--
  `TemperatureRise dT Q R` holds when `dT` is the steady-state rise driven by
  heat `Q` through resistance `R`.
-/
def TemperatureRise (dT Q R : Int) : Prop := dT = Q * R

/-- A product of positive integers is positive. -/
theorem mul_pos_of_pos {a b : Int} (ha : 0 < a) (hb : 0 < b) : 0 < a * b :=
  Int.mul_pos ha hb

/--
  Under positive area and conductivity and nonnegative thickness, the idealized
  one-dimensional resistance is nonnegative.
-/
theorem resistance_nonneg {R L k A : Int}
    (h : Resistance R L k A) (hL : 0 ≤ L) (hk : 0 < k) (hA : 0 < A) : 0 ≤ R := by
  unfold Resistance at h
  by_contra hneg
  push_neg at hneg
  have hkA : 0 < k * A := Int.mul_pos hk hA
  have : R * (k * A) < 0 := Int.mul_neg_of_neg_of_pos hneg hkA
  omega

/--
  Under nonnegative heat and resistance, the idealized temperature rise is
  nonnegative.
-/
theorem temperature_rise_nonneg {dT Q R : Int}
    (h : TemperatureRise dT Q R) (hQ : 0 ≤ Q) (hR : 0 ≤ R) : 0 ≤ dT := by
  unfold TemperatureRise at h
  rw [h]
  exact Int.mul_nonneg hQ hR

end Thermal
end Maha
