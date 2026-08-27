export interface WasmScienceKernel {
    normalizeAngleMicrodegrees(value: bigint): bigint;
    divideHalfEven(numerator: bigint, denominator: bigint): bigint;
    convertScaled(value: bigint, numerator: bigint, denominator: bigint): bigint;
    intervalAddLower(aLower: bigint, bLower: bigint): bigint;
    intervalAddUpper(aUpper: bigint, bUpper: bigint): bigint;
    integerSqrt(value: bigint): bigint;
    rootSumSquaresFloor(a: bigint, b: bigint): bigint;
    angularSeparationMicrodegrees(a: bigint, b: bigint): bigint;
    zodiacSignIndex(angle: bigint): bigint;
    zodiacBoundaryDistanceMicrodegrees(angle: bigint): bigint;
    layerThermalResistanceNanoKelvinPerWatt(thicknessNanometers: bigint, areaSquareMicrometers: bigint, conductivityMilliwattsPerMeterKelvin: bigint): bigint;
    temperatureRiseMicrokelvin(heatMilliwatts: bigint, resistanceNanoKelvinPerWatt: bigint): bigint;
}
export declare function instantiateKernel(bytes: BufferSource): Promise<WasmScienceKernel>;
//# sourceMappingURL=kernel.d.ts.map