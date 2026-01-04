import CalculationParameters from './CalculationParameters';
import SolarTime from './SolarTime';
import TimeComponents from './TimeComponents';
import {
  dateByAddingDays,
  dateByAddingMinutes,
  dateByAddingSeconds,
  dayOfYear,
  isValidDate,
  roundedMinute,
} from './DateUtils';
import {
  PolarCircleResolution,
  polarCircleResolvedValues,
} from './PolarCircleResolution';
import { shadowLength } from './Madhab';
import Astronomical from './Astronomical';
import HighLatitudeFajrRule, {
  highLatitudeAqrabulAyyamResolver,
} from './HighLatitudeFajrRule';
import Coordinates from './Coordinates';

/**
 * Minimal internal context:
 * - Holds shared expensive/central state (solar times + config)
 * - Avoids "cached results" like sunriseTime/asrTime which are cheap to derive
 */
type CalcContext = Readonly<{
  coordinates: Coordinates;
  date: Date;
  solarTime: SolarTime;
  tomorrowSolarTime: SolarTime;
  parameters: CalculationParameters;
  nightSeconds: number;
}>;

/** Resolve solar times, including optional polar circle resolution. */
function resolveSolarTimes(
  coordinates: Coordinates,
  date: Date,
  p: CalculationParameters,
) {
  let solarTime = new SolarTime(date, coordinates);

  let sunriseTime = new TimeComponents(solarTime.sunrise).utcDate(date);
  let sunsetTime = new TimeComponents(solarTime.sunset).utcDate(date);

  const tomorrow = dateByAddingDays(date, 1);
  let tomorrowSolarTime = new SolarTime(tomorrow, coordinates);

  const polarCircleResolver = p.polarCircleResolution;
  if (
    (!isValidDate(sunriseTime) ||
      !isValidDate(sunsetTime) ||
      isNaN(tomorrowSolarTime.sunrise)) &&
    polarCircleResolver !== PolarCircleResolution.Unresolved
  ) {
    const resolved = polarCircleResolvedValues(
      polarCircleResolver,
      date,
      coordinates,
    );

    solarTime = resolved.solarTime;
    tomorrowSolarTime = resolved.tomorrowSolarTime;

    // recompute derived sunrise/sunset for validity after resolution
    sunriseTime = new TimeComponents(solarTime.sunrise).utcDate(date);
    sunsetTime = new TimeComponents(solarTime.sunset).utcDate(date);
  }

  return { solarTime, tomorrowSolarTime };
}

function computeNightSeconds(
  tomorrowSolarTime: SolarTime,
  tomorrow: Date,
  sunsetTime: Date,
) {
  const tomorrowSunrise = new TimeComponents(tomorrowSolarTime.sunrise).utcDate(
    tomorrow,
  );
  return (Number(tomorrowSunrise) - Number(sunsetTime)) / 1000;
}

export function buildContext(
  coordinates: Coordinates,
  date: Date,
  parameters: CalculationParameters,
): CalcContext {
  const { solarTime, tomorrowSolarTime } = resolveSolarTimes(
    coordinates,
    date,
    parameters,
  );

  const tomorrow = dateByAddingDays(date, 1);
  const sunsetTime = new TimeComponents(solarTime.sunset).utcDate(date);
  const nightSeconds = computeNightSeconds(
    tomorrowSolarTime,
    tomorrow,
    sunsetTime,
  );

  return {
    coordinates,
    date,
    solarTime,
    tomorrowSolarTime,
    parameters,
    nightSeconds,
  };
}

export function totalAdjustment(
  p: CalculationParameters,
  key: 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha',
) {
  return (p.adjustments[key] || 0) + (p.methodAdjustments[key] || 0);
}

export function applyAdjustmentAndRounding(
  base: Date,
  adjustmentMinutes: number,
  p: CalculationParameters,
) {
  return roundedMinute(
    dateByAddingMinutes(base, adjustmentMinutes),
    p.rounding,
  );
}

// ---- Base (unadjusted, unrounded) times ----

export function baseSunrise(ctx: CalcContext) {
  return new TimeComponents(ctx.solarTime.sunrise).utcDate(ctx.date);
}

export function baseSunset(ctx: CalcContext) {
  return new TimeComponents(ctx.solarTime.sunset).utcDate(ctx.date);
}

export function baseDhuhr(ctx: CalcContext) {
  return new TimeComponents(ctx.solarTime.transit).utcDate(ctx.date);
}

export function baseAsr(ctx: CalcContext) {
  const { solarTime, date, parameters: p } = ctx;
  return new TimeComponents(
    solarTime.afternoon(shadowLength(p.madhab)),
  ).utcDate(date);
}

export function baseFajr(ctx: CalcContext) {
  const {
    solarTime,
    coordinates,
    date,
    parameters: p,
    nightSeconds: night,
  } = ctx;

  const sunriseTime = baseSunrise(ctx);

  let fajrTime = new TimeComponents(
    solarTime.hourAngle(-1 * p.fajrAngle, false),
  ).utcDate(date);

  // special case for moonsighting committee above latitude 55
  if (p.method === 'MoonsightingCommittee' && coordinates.latitude >= 55) {
    const nightFraction = night / 7;
    fajrTime = dateByAddingSeconds(sunriseTime, -nightFraction);
  }

  const safeFajr = (() => {
    if (p.method === 'MoonsightingCommittee') {
      return Astronomical.seasonAdjustedMorningTwilight(
        coordinates.latitude,
        dayOfYear(date),
        date.getFullYear(),
        sunriseTime,
      );
    }

    if (p.method === 'UnitedKingdom' && !isNaN(fajrTime.getTime())) {
      return fajrTime;
    }

    if (
      p.highLatitudeFajrRule === HighLatitudeFajrRule.AqrabYaum &&
      isNaN(solarTime.hourAngle(-1 * p.fajrAngle, false))
    ) {
      const lastFajrDate = highLatitudeAqrabulAyyamResolver(
        date,
        coordinates,
        p.fajrAngle,
      );
      const lastFajrSolarTime = new SolarTime(lastFajrDate, coordinates);

      return new TimeComponents(
        lastFajrSolarTime.hourAngle(-1 * p.fajrAngle, false),
      ).utcDate(date);
    }

    const portion = p.nightPortions().fajr;
    const nightFraction = portion * night;
    return dateByAddingSeconds(sunriseTime, -nightFraction);
  })();

  if (isNaN(fajrTime.getTime()) || safeFajr > fajrTime) {
    fajrTime = safeFajr;
  }

  return fajrTime;
}

export function baseIsha(ctx: CalcContext) {
  const {
    solarTime,
    coordinates,
    date,
    parameters: p,
    nightSeconds: night,
  } = ctx;

  const sunsetTime = baseSunset(ctx);

  if (p.ishaInterval > 0) {
    return dateByAddingMinutes(sunsetTime, p.ishaInterval);
  }

  let ishaTime = new TimeComponents(
    solarTime.hourAngle(-1 * p.ishaAngle, true),
  ).utcDate(date);

  // special case for moonsighting committee above latitude 55
  if (p.method === 'MoonsightingCommittee' && coordinates.latitude >= 55) {
    const nightFraction = night / 7;
    ishaTime = dateByAddingSeconds(sunsetTime, nightFraction);
  }

  const safeIsha = (() => {
    if (p.method === 'MoonsightingCommittee') {
      return Astronomical.seasonAdjustedEveningTwilight(
        coordinates.latitude,
        dayOfYear(date),
        date.getFullYear(),
        sunsetTime,
        p.shafaq,
      );
    }

    const portion = p.nightPortions().isha;
    const nightFraction = portion * night;
    return dateByAddingSeconds(sunsetTime, nightFraction);
  })();

  if (isNaN(ishaTime.getTime()) || safeIsha < ishaTime) {
    ishaTime = safeIsha;
  }

  return ishaTime;
}

export function baseMaghrib(ctx: CalcContext, ishaBase: Date) {
  const { solarTime, date, parameters: p } = ctx;

  const sunsetTime = baseSunset(ctx);
  let maghribTime = sunsetTime;

  if (p.maghribAngle) {
    const angleBasedMaghrib = new TimeComponents(
      solarTime.hourAngle(-1 * p.maghribAngle, true),
    ).utcDate(date);

    if (sunsetTime < angleBasedMaghrib && ishaBase > angleBasedMaghrib) {
      maghribTime = angleBasedMaghrib;
    }
  }

  return maghribTime;
}
