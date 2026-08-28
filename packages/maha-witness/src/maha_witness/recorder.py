"""Decorator and context-manager APIs for explicit witness capture."""

from __future__ import annotations

import functools
import platform
from contextlib import AbstractContextManager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Mapping, Sequence, TypeVar

from .artifacts import ArtifactSpec, commit_artifact
from .receipt import build_receipt

T = TypeVar("T")


def _now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def default_environment(packages: Mapping[str, str] | None = None) -> dict[str, object]:
    """Capture a small allowlist. Environment variables are never read."""

    return {
        "pythonVersion": platform.python_version(),
        "pythonImplementation": platform.python_implementation(),
        "platformSystem": platform.system(),
        "platformMachine": platform.machine(),
        "declaredPackages": dict(packages or {}),
    }


class WitnessRecorder(AbstractContextManager["WitnessRecorder"]):
    def __init__(
        self,
        *,
        job_id: str,
        callable_identity: Mapping[str, str],
        input_artifacts: Sequence[ArtifactSpec] = (),
        output_artifacts: Sequence[ArtifactSpec] = (),
        environment: Mapping[str, object] | None = None,
        declared_packages: Mapping[str, str] | None = None,
        random_seeds: Mapping[str, str | int] | None = None,
        configuration: Mapping[str, object] | None = None,
        adapters: Sequence[Mapping[str, object]] = (),
        dossier_id: str | None = None,
        claim_ids: Sequence[str] = (),
        calculation_receipt_ids: Sequence[str] = (),
        environment_complete: bool = False,
        clock: Callable[[], str] = _now,
        sink: Callable[[dict[str, Any]], None] | None = None,
    ) -> None:
        self.job_id = job_id
        self.callable_identity = dict(callable_identity)
        self.input_specs = tuple(input_artifacts)
        self.output_specs = tuple(output_artifacts)
        self.environment = dict(environment or default_environment(declared_packages))
        self.random_seeds = dict(random_seeds or {})
        self.configuration = dict(configuration or {})
        self.adapters = tuple(adapters)
        self.dossier_id = dossier_id
        self.claim_ids = tuple(claim_ids)
        self.calculation_receipt_ids = tuple(calculation_receipt_ids)
        self.environment_complete = environment_complete
        self.clock = clock
        self.sink = sink
        self.receipt: dict[str, Any] | None = None
        self._started_at: str | None = None
        self._inputs: list[dict[str, object]] = []

    def __enter__(self) -> "WitnessRecorder":
        self._started_at = self.clock()
        self._inputs = [commit_artifact(spec) for spec in self.input_specs]
        return self

    def __exit__(self, exception_type: type[BaseException] | None, _value: BaseException | None, _traceback: object) -> bool:
        outputs: list[dict[str, object]] = []
        if exception_type is None:
            outputs = [commit_artifact(spec) for spec in self.output_specs]
        else:
            # Preserve any output that exists, while never hiding the original
            # exception because an expected output was not produced.
            outputs = [
                commit_artifact(spec)
                for spec in self.output_specs
                if Path(spec.path).is_file() and not Path(spec.path).is_symlink()
            ]
        self.receipt = build_receipt(
            job_id=self.job_id,
            callable_identity=self.callable_identity,
            status="failed" if exception_type else "succeeded",
            started_at=self._started_at or self.clock(),
            finished_at=self.clock(),
            artifacts=[*self._inputs, *outputs],
            environment=self.environment,
            random_seeds=self.random_seeds,
            configuration=self.configuration,
            adapters=self.adapters,
            dossier_id=self.dossier_id,
            claim_ids=self.claim_ids,
            calculation_receipt_ids=self.calculation_receipt_ids,
            environment_complete=self.environment_complete,
            failure_type=exception_type.__name__ if exception_type else None,
        )
        if self.sink:
            self.sink(self.receipt)
        return False


def witness(**recorder_options: Any) -> Callable[[Callable[..., T]], Callable[..., T]]:
    """Record one receipt per invocation without capturing function arguments.

    Arguments can contain secrets, so they are never serialized implicitly.
    Declare safe configuration and input artifacts in ``recorder_options``.
    The latest receipt is available as ``decorated.last_receipt``.
    """

    def decorate(function: Callable[..., T]) -> Callable[..., T]:
        identity = {"module": function.__module__, "qualname": function.__qualname__}

        @functools.wraps(function)
        def wrapped(*args: Any, **kwargs: Any) -> T:
            recorder = WitnessRecorder(callable_identity=identity, **recorder_options)
            try:
                with recorder:
                    result = function(*args, **kwargs)
            finally:
                wrapped.last_receipt = recorder.receipt  # type: ignore[attr-defined]
            return result

        wrapped.last_receipt = None  # type: ignore[attr-defined]
        return wrapped

    return decorate
