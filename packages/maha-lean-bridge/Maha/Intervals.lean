import Maha.CanonicalArithmetic

/-
  Interval arithmetic theorems.

  These establish properties of the *definitions* in CanonicalArithmetic. They
  say nothing about whether the WASM kernel, the AssemblyScript source, or any
  measured quantity behaves this way.
-/

namespace Maha
namespace Interval

/-- Adding valid intervals yields a valid interval: `lower ≤ upper` is preserved. -/
theorem add_valid {a b : Interval} (ha : a.Valid) (hb : b.Valid) : (add a b).Valid := by
  unfold Valid add at *
  simp only []
  exact Int.add_le_add ha hb

/-- Interval addition contains every sum of members. -/
theorem add_mem {a b : Interval} {x y : Int} (hx : a.Mem x) (hy : b.Mem y) :
    (add a b).Mem (x + y) := by
  unfold Mem add at *
  exact ⟨Int.add_le_add hx.1 hy.1, Int.add_le_add hx.2 hy.2⟩

/-- Interval addition is commutative. -/
theorem add_comm (a b : Interval) : add a b = add b a := by
  unfold add
  simp [Int.add_comm]

/-- The zero interval is a right identity for interval addition. -/
theorem add_zero (a : Interval) : add a zero = a := by
  unfold add zero
  simp

/-- The zero interval is a left identity for interval addition. -/
theorem zero_add (a : Interval) : add zero a = a := by
  unfold add zero
  simp

end Interval
end Maha
