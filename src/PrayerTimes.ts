import Prayer from './Prayer';
import CalculationParameters from './CalculationParameters';
import Coordinates from './Coordinates';
import { roundedMinute } from './DateUtils';
import { ValueOf } from './TypeUtils';
import {
  applyAdjustmentAndRounding,
  baseAsr,
  baseDhuhr,
  baseFajr,
  baseIsha,
  baseMaghrib,
  baseSunrise,
  baseSunset,
  buildContext,
  totalAdjustment,
} from './PrayerTimesCompute';

export type PrayerTimesResult = {
  fajr: Date;
  sunrise: Date;
  dhuhr: Date;
  asr: Date;
  sunset: Date;
  maghrib: Date;
  isha: Date;
};

export function computePrayerTimes(
  coordinates: Coordinates,
  date: Date,
  parameters: CalculationParameters,
): PrayerTimesResult {
  const ctx = buildContext(coordinates, date, parameters);

  const fajrBase = baseFajr(ctx);
  const sunriseBase = baseSunrise(ctx);
  const dhuhrBase = baseDhuhr(ctx);
  const asrBase = baseAsr(ctx);
  const sunsetBase = baseSunset(ctx);

  const ishaBase = baseIsha(ctx);
  const maghribBase = baseMaghrib(ctx, ishaBase);

  return {
    fajr: applyAdjustmentAndRounding(
      fajrBase,
      totalAdjustment(parameters, 'fajr'),
      parameters,
    ),
    sunrise: applyAdjustmentAndRounding(
      sunriseBase,
      totalAdjustment(parameters, 'sunrise'),
      parameters,
    ),
    dhuhr: applyAdjustmentAndRounding(
      dhuhrBase,
      totalAdjustment(parameters, 'dhuhr'),
      parameters,
    ),
    asr: applyAdjustmentAndRounding(
      asrBase,
      totalAdjustment(parameters, 'asr'),
      parameters,
    ),
    sunset: roundedMinute(sunsetBase, parameters.rounding),
    maghrib: applyAdjustmentAndRounding(
      maghribBase,
      totalAdjustment(parameters, 'maghrib'),
      parameters,
    ),
    isha: applyAdjustmentAndRounding(
      ishaBase,
      totalAdjustment(parameters, 'isha'),
      parameters,
    ),
  };
}

/**
 * Pure helper to match the old instance method.
 */
export function timeForPrayer(
  times: PrayerTimesResult,
  prayer: ValueOf<typeof Prayer>,
): Date | null {
  if (prayer === Prayer.Fajr) return times.fajr;
  if (prayer === Prayer.Sunrise) return times.sunrise;
  if (prayer === Prayer.Dhuhr) return times.dhuhr;
  if (prayer === Prayer.Asr) return times.asr;
  if (prayer === Prayer.Maghrib) return times.maghrib;
  if (prayer === Prayer.Isha) return times.isha;
  return null;
}

/**
 * Backwards compatible class wrapper.
 */
export default class PrayerTimes implements PrayerTimesResult {
  fajr: Date;
  sunrise: Date;
  dhuhr: Date;
  asr: Date;
  sunset: Date;
  maghrib: Date;
  isha: Date;

  constructor(
    public coordinates: Coordinates,
    public date: Date,
    public calculationParameters: CalculationParameters,
  ) {
    const t = computePrayerTimes(coordinates, date, calculationParameters);
    this.fajr = t.fajr;
    this.sunrise = t.sunrise;
    this.dhuhr = t.dhuhr;
    this.asr = t.asr;
    this.sunset = t.sunset;
    this.maghrib = t.maghrib;
    this.isha = t.isha;
  }

  timeForPrayer(prayer: ValueOf<typeof Prayer>) {
    return timeForPrayer(this, prayer);
  }

  currentPrayer(date = new Date()) {
    if (date >= this.isha) return Prayer.Isha;
    if (date >= this.maghrib) return Prayer.Maghrib;
    if (date >= this.asr) return Prayer.Asr;
    if (date >= this.dhuhr) return Prayer.Dhuhr;
    if (date >= this.sunrise) return Prayer.Sunrise;
    if (date >= this.fajr) return Prayer.Fajr;
    return Prayer.None;
  }

  nextPrayer(date = new Date()) {
    if (date >= this.isha) return Prayer.None;
    if (date >= this.maghrib) return Prayer.Isha;
    if (date >= this.asr) return Prayer.Maghrib;
    if (date >= this.dhuhr) return Prayer.Asr;
    if (date >= this.sunrise) return Prayer.Dhuhr;
    if (date >= this.fajr) return Prayer.Sunrise;
    return Prayer.Fajr;
  }
}
