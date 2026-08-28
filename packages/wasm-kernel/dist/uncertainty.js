export const UNCERTAINTY_MODEL_VERSION = 'maha-interval-uncertainty/1.0';
function parsed(interval, name) {
    if (!/^-?\d+$/.test(interval.lower) || !/^-?\d+$/.test(interval.upper) || !interval.unit.trim())
        throw new Error(`${name} must declare integer lower/upper bounds and a unit.`);
    const lower = BigInt(interval.lower);
    const upper = BigInt(interval.upper);
    if (lower > upper)
        throw new Error(`${name} lower bound must not exceed its upper bound.`);
    return { lower, upper };
}
function floorDivide(numerator, denominator) {
    if (denominator <= 0n)
        throw new Error('Uncertainty denominator must be positive.');
    const quotient = numerator / denominator;
    const remainder = numerator % denominator;
    return remainder < 0n ? quotient - 1n : quotient;
}
function ceilDivide(numerator, denominator) {
    return -floorDivide(-numerator, denominator);
}
export function addIntervals(left, right) {
    if (left.unit !== right.unit)
        throw new Error('Intervals must use the same unit for addition.');
    const a = parsed(left, 'left interval');
    const b = parsed(right, 'right interval');
    return { lower: (a.lower + b.lower).toString(), upper: (a.upper + b.upper).toString(), unit: left.unit };
}
export function multiplyIntervals(left, right, outputUnit) {
    if (!outputUnit.trim())
        throw new Error('An output unit is required for interval multiplication.');
    const a = parsed(left, 'left interval');
    const b = parsed(right, 'right interval');
    const values = [a.lower * b.lower, a.lower * b.upper, a.upper * b.lower, a.upper * b.upper];
    return { lower: values.reduce((x, y) => x < y ? x : y).toString(), upper: values.reduce((x, y) => x > y ? x : y).toString(), unit: outputUnit };
}
/** Monotone positive interval propagation for R = thickness * 10^15 / (area * conductivity). */
export function thermalResistanceInterval(input) {
    const thickness = parsed(input.thicknessNanometers, 'thicknessNanometers');
    const area = parsed(input.areaSquareMicrometers, 'areaSquareMicrometers');
    const conductivity = parsed(input.conductivityMilliwattsPerMeterKelvin, 'conductivityMilliwattsPerMeterKelvin');
    if (thickness.lower < 0n || area.lower <= 0n || conductivity.lower <= 0n)
        throw new Error('Thermal uncertainty intervals must remain inside the positive model domain.');
    const scale = 1000000000000000n;
    return {
        lower: floorDivide(thickness.lower * scale, area.upper * conductivity.upper).toString(),
        upper: ceilDivide(thickness.upper * scale, area.lower * conductivity.lower).toString(),
        unit: 'nK/W',
    };
}
export function temperatureRiseInterval(input) {
    const heat = parsed(input.heatMilliwatts, 'heatMilliwatts');
    const resistance = parsed(input.resistanceNanoKelvinPerWatt, 'resistanceNanoKelvinPerWatt');
    if (heat.lower < 0n || resistance.lower < 0n)
        throw new Error('Temperature-rise uncertainty intervals must remain non-negative.');
    return {
        lower: floorDivide(heat.lower * resistance.lower, 1000000000n).toString(),
        upper: ceilDivide(heat.upper * resistance.upper, 1000000000n).toString(),
        unit: 'uK',
    };
}
export function createOptionalIntervalMultiplyReceiptInput(request) {
    if (!request)
        return null;
    if (![request.leftName, request.rightName, request.outputName].every((name) => /^[A-Za-z][A-Za-z0-9]*$/.test(name)))
        throw new Error('Interval receipt field names must be bounded identifiers.');
    const output = multiplyIntervals(request.left, request.right, request.outputUnit);
    return {
        canonicalizationVersion: 'maha-dossier-canonical/1.0',
        module: 'core.interval', operation: 'multiply',
        inputs: { [request.leftName]: `[${request.left.lower},${request.left.upper}]`, [request.rightName]: `[${request.right.lower},${request.right.upper}]` },
        units: { [request.leftName]: request.left.unit, [request.rightName]: request.right.unit, [request.outputName]: output.unit },
        constants: {}, output: { [request.outputName]: `[${output.lower},${output.upper}]` },
        uncertainty: { model: UNCERTAINTY_MODEL_VERSION, interval: 'inclusive; exact integer products', lower: output.lower, upper: output.upper, unit: output.unit },
        precisionPolicy: 'signed integer interval arithmetic; exact multiplication; overflow=abort',
        kernelVersion: request.kernel.kernelVersion, kernelSha256: request.kernel.kernelSha256,
        conformanceVersion: request.kernel.conformanceVersion, conformanceSha256: request.kernel.conformanceSha256,
        runtime: 'wasm-i64-fixed-point', compiler: request.kernel.compiler,
        arithmetic: { integerModel: 'signed-i64', rounding: 'nearest-ties-to-even', overflow: 'abort' },
    };
}
/** Optional by construction: no request means no calculation and no invented values. */
export function createOptionalThermalReceiptInput(request) {
    if (!request)
        return null;
    const output = thermalResistanceInterval(request);
    return {
        canonicalizationVersion: 'maha-dossier-canonical/1.0',
        module: 'semiconductor.thermal', operation: 'layer-resistance-interval',
        inputs: {
            thicknessNanometers: `[${request.thicknessNanometers.lower},${request.thicknessNanometers.upper}]`,
            areaSquareMicrometers: `[${request.areaSquareMicrometers.lower},${request.areaSquareMicrometers.upper}]`,
            conductivityMilliwattsPerMeterKelvin: `[${request.conductivityMilliwattsPerMeterKelvin.lower},${request.conductivityMilliwattsPerMeterKelvin.upper}]`,
        },
        units: { thicknessNanometers: request.thicknessNanometers.unit, areaSquareMicrometers: request.areaSquareMicrometers.unit, conductivityMilliwattsPerMeterKelvin: request.conductivityMilliwattsPerMeterKelvin.unit, resistanceNanoKelvinPerWatt: output.unit },
        constants: { resistanceScale: '1000000000000000' },
        output: { lower: output.lower, upper: output.upper },
        uncertainty: { model: UNCERTAINTY_MODEL_VERSION, interval: 'inclusive; outward-rounded', lower: output.lower, upper: output.upper, unit: output.unit },
        precisionPolicy: 'signed integer interval arithmetic; lower=floor; upper=ceil; overflow=abort',
        kernelVersion: request.kernel.kernelVersion, kernelSha256: request.kernel.kernelSha256,
        conformanceVersion: request.kernel.conformanceVersion, conformanceSha256: request.kernel.conformanceSha256,
        runtime: 'wasm-i64-fixed-point', compiler: request.kernel.compiler,
        arithmetic: { integerModel: 'signed-i64', rounding: 'nearest-ties-to-even', overflow: 'abort' },
    };
}
//# sourceMappingURL=uncertainty.js.map