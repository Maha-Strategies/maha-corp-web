/-
  The evidence boundary, stated formally.

  The rest of this package proves arithmetic. This file proves the thing the
  arithmetic must never be mistaken for. It models the categories of support a
  claim can carry and shows, inside Lean, that a machine-checked proof is not
  any of the empirical ones.

  This is a formalization of our own bookkeeping, not a discovery about the
  world. Its value is that the distinction is checkable rather than merely
  documented, so a future change that quietly conflates the categories fails to
  compile.
-/

namespace Maha
namespace Evidence

/-- The kinds of support a claim can carry. They are deliberately disjoint. -/
inductive Support where
  /-- A passage in an inspected source supports the claim. -/
  | sourcePassage
  /-- A machine-checked Lean proof of a conditional formal statement. -/
  | formalProof
  /-- A deterministic calculation with a receipt. -/
  | calculation
  /-- An observed execution with a runtime witness. -/
  | runtimeWitness
  /-- Reproduction by an independent party. -/
  | independentReproduction
  deriving DecidableEq, Repr

/--
  Whether a support kind is empirical: whether it constitutes an observation of
  the world rather than a deduction or a computation.
-/
def isEmpirical : Support → Bool
  | .sourcePassage => true
  | .independentReproduction => true
  | .runtimeWitness => true
  | .formalProof => false
  | .calculation => false

/-- A formal proof is not empirical support. -/
theorem formalProof_not_empirical : isEmpirical .formalProof = false := by decide

/-- Proof attachment and source-passage support are distinct categories. -/
theorem formalProof_ne_sourcePassage : Support.formalProof ≠ Support.sourcePassage := by decide

/-- A formal proof is not independent reproduction. -/
theorem formalProof_ne_independentReproduction :
    Support.formalProof ≠ Support.independentReproduction := by decide

/-- A formal proof is not a deterministic calculation. -/
theorem formalProof_ne_calculation : Support.formalProof ≠ Support.calculation := by decide

/--
  A claim's declared support set.

  `assumptions` records the empirical premises the claim rests on. A formal
  proof discharges none of them: it establishes an implication whose antecedent
  is exactly those assumptions.
-/
structure Claim where
  assumptions : List String
  support : List Support
  deriving Repr

/-- Attaching a formal proof to a claim. -/
def attachFormalProof (c : Claim) : Claim :=
  { c with support := Support.formalProof :: c.support }

/--
  Machine-checked implication does not remove declared empirical assumptions.

  This is the central boundary theorem: attaching a proof leaves the assumption
  list untouched, so a proof can never be used to discharge an empirical premise.
-/
theorem attach_preserves_assumptions (c : Claim) :
    (attachFormalProof c).assumptions = c.assumptions := by
  rfl

/--
  Attaching a formal proof adds no empirical support.

  Every empirical element of the resulting support list was already present.
-/
theorem attach_adds_no_empirical_support (c : Claim) (s : Support)
    (hmem : s ∈ (attachFormalProof c).support) (hemp : isEmpirical s = true) :
    s ∈ c.support := by
  unfold attachFormalProof at hmem
  cases hmem with
  | head => simp [isEmpirical] at hemp
  | tail _ h => exact h

end Evidence
end Maha
