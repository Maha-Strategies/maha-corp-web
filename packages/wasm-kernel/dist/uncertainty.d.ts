import type { CalculationReceiptInput } from './receipt.js';
export declare const UNCERTAINTY_MODEL_VERSION: "maha-interval-uncertainty/1.0";
export interface IntegerInterval {
    lower: string;
    upper: string;
    unit: string;
}
export declare function addIntervals(left: IntegerInterval, right: IntegerInterval): IntegerInterval;
export declare function multiplyIntervals(left: IntegerInterval, right: IntegerInterval, outputUnit: string): IntegerInterval;
/** Monotone positive interval propagation for R = thickness * 10^15 / (area * conductivity). */
export declare function thermalResistanceInterval(input: {
    thicknessNanometers: IntegerInterval;
    areaSquareMicrometers: IntegerInterval;
    conductivityMilliwattsPerMeterKelvin: IntegerInterval;
}): IntegerInterval;
export declare function temperatureRiseInterval(input: {
    heatMilliwatts: IntegerInterval;
    resistanceNanoKelvinPerWatt: IntegerInterval;
}): IntegerInterval;
export interface ThermalReceiptRequest {
    thicknessNanometers: IntegerInterval;
    areaSquareMicrometers: IntegerInterval;
    conductivityMilliwattsPerMeterKelvin: IntegerInterval;
    kernel: Pick<CalculationReceiptInput, 'kernelVersion' | 'kernelSha256' | 'conformanceVersion' | 'conformanceSha256' | 'compiler'>;
}
export interface IntervalMultiplyReceiptRequest {
    leftName: string;
    rightName: string;
    left: IntegerInterval;
    right: IntegerInterval;
    outputName: string;
    outputUnit: string;
    kernel: Pick<CalculationReceiptInput, 'kernelVersion' | 'kernelSha256' | 'conformanceVersion' | 'conformanceSha256' | 'compiler'>;
}
export declare function createOptionalIntervalMultiplyReceiptInput(request?: IntervalMultiplyReceiptRequest): CalculationReceiptInput | null;
/** Optional by construction: no request means no calculation and no invented values. */
export declare function createOptionalThermalReceiptInput(request?: ThermalReceiptRequest): CalculationReceiptInput | null;
//# sourceMappingURL=uncertainty.d.ts.map