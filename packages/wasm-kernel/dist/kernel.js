export async function instantiateKernel(bytes) {
    const imports = { env: { abort: () => { throw new WebAssembly.RuntimeError('WASM kernel aborted on an invalid or overflowing operation.'); } } };
    const result = await WebAssembly.instantiate(bytes, imports);
    const exports = result.instance.exports;
    const required = ['normalizeAngleMicrodegrees', 'divideHalfEven', 'convertScaled', 'intervalAddLower', 'intervalAddUpper', 'integerSqrt', 'rootSumSquaresFloor', 'angularSeparationMicrodegrees', 'zodiacSignIndex', 'zodiacBoundaryDistanceMicrodegrees', 'layerThermalResistanceNanoKelvinPerWatt', 'temperatureRiseMicrokelvin'];
    for (const name of required)
        if (typeof exports[name] !== 'function')
            throw new Error(`WASM kernel export ${name} is missing.`);
    return exports;
}
//# sourceMappingURL=kernel.js.map