/**
 * The built-in curve preset catalog.
 *
 * Presets are declarative expression option bags whose labels resolve through `t()`
 * at render time, so the gallery follows the active language.
 */
import { t } from "../../../../i18n/index.ts";
import type { MessageKey } from "../../../../i18n/index.ts";
import {
  PRESET_CATEGORIES,
  type CurvePreset,
  type TrajectoryOptions,
  type TrajectoryParameter,
} from "./curveTrajectoryTypes.ts";

/**
 * Preset text is read through `t()` when it is rendered, never when the module
 * loads.
 *
 * `CURVE_PRESETS` is a module-level constant, so label fields are accessors that
 * resolve through `t()`.
 */
const radiusParameter: TrajectoryParameter = {
  key: "radius",
  get label(): string {
    return t("model.trajectory.param.radius");
  },
  value: 200,
  min: 1,
  max: 2000,
  step: 1,
};
/** Build a numeric preset parameter whose label resolves through `t()` at render time. */
const parameter = (
  key: string,
  labelKey: MessageKey,
  value: number,
  min = 1,
  max = 1000,
  step = 1,
): TrajectoryParameter => ({
  key,
  get label(): string {
    return t(labelKey);
  },
  value,
  min,
  max,
  step,
});
/** Polar expression for a regular polygon with `sides` vertices. */
const polygon = (sides: number): TrajectoryOptions => ({
  mode: "polar",
  radiusExpression: `radius*cos(pi/${sides})/cos(theta-round(theta/(2*pi/${sides}))*(2*pi/${sides}))`,
});
/** Built-in presets in gallery order. */
export const CURVE_PRESETS: CurvePreset[] = [
  {
    id: "line",
    category: PRESET_CATEGORIES.basic,
    get name(): string {
      return t("model.trajectory.preset.line");
    },
    xExpression: "length*t",
    yExpression: "0",
    parameters: [parameter("length", "model.trajectory.param.length", 400)],
  },
  {
    id: "circle",
    category: PRESET_CATEGORIES.basic,
    get name(): string {
      return t("model.trajectory.preset.circle");
    },
    mode: "polar",
    radiusExpression: "radius",
    parameters: [radiusParameter],
  },
  ...(
    [
      [3, "model.trajectory.preset.polygon3"],
      [4, "model.trajectory.preset.polygon4"],
      [5, "model.trajectory.preset.polygon5"],
      [6, "model.trajectory.preset.polygon6"],
      [8, "model.trajectory.preset.polygon8"],
      [12, "model.trajectory.preset.polygon12"],
    ] as [number, MessageKey][]
  ).map(([sides, nameKey]) => ({
    id: `polygon-${sides}`,
    category: PRESET_CATEGORIES.basic,
    get name(): string {
      return t(nameKey);
    },
    ...polygon(sides),
    parameters: [radiusParameter],
  })),
  {
    id: "arc",
    category: PRESET_CATEGORIES.basic,
    get name(): string {
      return t("model.trajectory.preset.arc");
    },
    mode: "polar",
    radiusExpression: "radius",
    angleEnd: "sweep*pi/180",
    parameters: [
      radiusParameter,
      parameter("sweep", "model.trajectory.param.sweep", 180, -720, 720),
    ],
  },
  {
    id: "rectangle",
    category: PRESET_CATEGORIES.basic,
    get name(): string {
      return t("model.trajectory.preset.rectangle");
    },
    mode: "polar",
    radiusExpression:
      "min(width/max(abs(cos(theta)),0.000001),height/max(abs(sin(theta)),0.000001))",
    parameters: [
      parameter("width", "model.trajectory.param.halfWidth", 250),
      parameter("height", "model.trajectory.param.halfHeight", 150),
    ],
  },
  {
    id: "diamond",
    category: PRESET_CATEGORIES.basic,
    get name(): string {
      return t("model.trajectory.preset.diamond");
    },
    mode: "polar",
    radiusExpression: "1/(abs(cos(theta))/width+abs(sin(theta))/height)",
    parameters: [
      parameter("width", "model.trajectory.param.semiAxisX", 260),
      parameter("height", "model.trajectory.param.semiAxisY", 160),
    ],
  },
  {
    id: "star",
    category: PRESET_CATEGORIES.basic,
    get name(): string {
      return t("model.trajectory.preset.star");
    },
    shape: "star",
    parameters: [
      radiusParameter,
      parameter("points", "model.trajectory.param.points", 5, 3, 20),
      parameter("inner", "model.trajectory.param.innerRatio", 0.4, 0.05, 1, 0.01),
    ],
  },
  {
    id: "ellipse",
    category: PRESET_CATEGORIES.advanced,
    get name(): string {
      return t("model.trajectory.preset.ellipse");
    },
    xExpression: "width*cos(2*pi*t)",
    yExpression: "height*sin(2*pi*t)",
    parameters: [
      parameter("width", "model.trajectory.param.semiAxisX", 280),
      parameter("height", "model.trajectory.param.semiAxisY", 140),
    ],
  },
  {
    id: "heart",
    category: PRESET_CATEGORIES.advanced,
    get name(): string {
      return t("model.trajectory.preset.heart");
    },
    xExpression: "radius*sin(2*pi*t)^3",
    yExpression: "radius*(13*cos(2*pi*t)-5*cos(4*pi*t)-2*cos(6*pi*t)-cos(8*pi*t))/16",
    parameters: [radiusParameter],
  },
  {
    id: "spiral",
    category: PRESET_CATEGORIES.advanced,
    get name(): string {
      return t("model.trajectory.preset.spiral");
    },
    mode: "polar",
    radiusExpression: "radius*t",
    angleEnd: "2*pi*turns",
    parameters: [
      radiusParameter,
      parameter("turns", "model.trajectory.param.turns", 3, 0.1, 20, 0.1),
    ],
  },
  {
    id: "rose",
    category: PRESET_CATEGORIES.advanced,
    get name(): string {
      return t("model.trajectory.preset.rose");
    },
    mode: "polar",
    radiusExpression: "radius*cos(petals*theta)",
    parameters: [radiusParameter, parameter("petals", "model.trajectory.param.petals", 5, 1, 20)],
  },
  {
    id: "infinity",
    category: PRESET_CATEGORIES.advanced,
    get name(): string {
      return t("model.trajectory.preset.infinity");
    },
    xExpression: "radius*cos(2*pi*t)",
    yExpression: "radius*sin(4*pi*t)/2",
    parameters: [radiusParameter],
  },
  {
    id: "lissajous",
    category: PRESET_CATEGORIES.advanced,
    get name(): string {
      return t("model.trajectory.preset.lissajous");
    },
    xExpression: "radius*sin(a*2*pi*t)",
    yExpression: "radius*sin(b*2*pi*t+phase)",
    parameters: [
      radiusParameter,
      parameter("a", "model.trajectory.param.frequencyX", 3, 1, 20),
      parameter("b", "model.trajectory.param.frequencyY", 2, 1, 20),
      parameter("phase", "model.trajectory.param.phaseRadians", 0, -6.3, 6.3, 0.1),
    ],
  },
  {
    id: "parabola",
    category: PRESET_CATEGORIES.advanced,
    get name(): string {
      return t("model.trajectory.preset.parabola");
    },
    xExpression: "width*(2*t-1)",
    yExpression: "height*(2*t-1)^2",
    parameters: [
      parameter("width", "model.trajectory.param.halfWidth", 250),
      parameter("height", "model.trajectory.param.halfHeight", 200),
    ],
  },
  {
    id: "sine",
    category: PRESET_CATEGORIES.advanced,
    get name(): string {
      return t("model.trajectory.preset.sine");
    },
    xExpression: "length*(t-0.5)",
    yExpression: "amplitude*sin(2*pi*waves*t+phase)",
    parameters: [
      parameter("length", "model.trajectory.param.length", 600),
      parameter("amplitude", "model.trajectory.param.amplitude", 100),
      parameter("waves", "model.trajectory.param.waves", 2, 0.1, 20, 0.1),
      parameter("phase", "model.trajectory.param.phase", 0, -6.3, 6.3, 0.1),
    ],
  },
  {
    id: "damped-wave",
    category: PRESET_CATEGORIES.advanced,
    get name(): string {
      return t("model.trajectory.preset.dampedWave");
    },
    xExpression: "length*(t-0.5)",
    yExpression: "amplitude*(1-t)^decay*sin(2*pi*waves*t)",
    parameters: [
      parameter("length", "model.trajectory.param.length", 600),
      parameter("amplitude", "model.trajectory.param.amplitude", 180),
      parameter("waves", "model.trajectory.param.waves", 4, 1, 20),
      parameter("decay", "model.trajectory.param.decay", 2, 0.1, 8, 0.1),
    ],
  },
  {
    id: "cycloid",
    category: PRESET_CATEGORIES.advanced,
    get name(): string {
      return t("model.trajectory.preset.cycloid");
    },
    xExpression: "radius*(2*pi*t-sin(2*pi*t)-pi)",
    yExpression: "radius*(1-cos(2*pi*t))",
    parameters: [parameter("radius", "model.trajectory.param.rollingRadius", 90)],
  },
  {
    id: "astroid",
    category: PRESET_CATEGORIES.advanced,
    get name(): string {
      return t("model.trajectory.preset.astroid");
    },
    xExpression: "radius*cos(2*pi*t)^3",
    yExpression: "radius*sin(2*pi*t)^3",
    parameters: [radiusParameter],
  },
  {
    id: "cardioid",
    category: PRESET_CATEGORIES.advanced,
    get name(): string {
      return t("model.trajectory.preset.cardioid");
    },
    mode: "polar",
    radiusExpression: "radius*(1-cos(theta))",
    parameters: [parameter("radius", "model.trajectory.param.baseRadius", 130)],
  },
  {
    id: "limacon",
    category: PRESET_CATEGORIES.advanced,
    get name(): string {
      return t("model.trajectory.preset.limacon");
    },
    mode: "polar",
    radiusExpression: "radius*(ratio+cos(theta))",
    parameters: [
      parameter("radius", "model.trajectory.param.baseRadius", 150),
      parameter("ratio", "model.trajectory.param.ringRatio", 0.5, 0.1, 3, 0.1),
    ],
  },
  {
    id: "log-spiral",
    category: PRESET_CATEGORIES.advanced,
    get name(): string {
      return t("model.trajectory.preset.logSpiral");
    },
    mode: "polar",
    radiusExpression: "radius*growth^t",
    angleEnd: "2*pi*turns",
    parameters: [
      parameter("radius", "model.trajectory.param.startRadius", 30),
      parameter("growth", "model.trajectory.param.radiusGrowth", 8, 0.1, 30, 0.1),
      parameter("turns", "model.trajectory.param.turns", 2, 0.1, 20, 0.1),
    ],
  },
  {
    id: "hypotrochoid",
    category: PRESET_CATEGORIES.advanced,
    get name(): string {
      return t("model.trajectory.preset.hypotrochoid");
    },
    xExpression: "(outer-inner)*cos(2*pi*turns*t)+pen*cos((outer-inner)/inner*2*pi*turns*t)",
    yExpression: "(outer-inner)*sin(2*pi*turns*t)-pen*sin((outer-inner)/inner*2*pi*turns*t)",
    parameters: [
      parameter("outer", "model.trajectory.param.outerRadius", 240),
      parameter("inner", "model.trajectory.param.rollingRadius", 90),
      parameter("pen", "model.trajectory.param.penDistance", 120),
      parameter("turns", "model.trajectory.param.turns", 3, 1, 20),
    ],
  },
  {
    id: "epitrochoid",
    category: PRESET_CATEGORIES.advanced,
    get name(): string {
      return t("model.trajectory.preset.epitrochoid");
    },
    xExpression: "(outer+inner)*cos(2*pi*turns*t)-pen*cos((outer+inner)/inner*2*pi*turns*t)",
    yExpression: "(outer+inner)*sin(2*pi*turns*t)-pen*sin((outer+inner)/inner*2*pi*turns*t)",
    parameters: [
      parameter("outer", "model.trajectory.param.fixedRadius", 120),
      parameter("inner", "model.trajectory.param.rollingRadius", 40),
      parameter("pen", "model.trajectory.param.penDistance", 70),
      parameter("turns", "model.trajectory.param.turns", 1, 1, 20),
    ],
  },
  {
    id: "superellipse",
    category: PRESET_CATEGORIES.advanced,
    get name(): string {
      return t("model.trajectory.preset.superellipse");
    },
    mode: "polar",
    radiusExpression: "1/((abs(cos(theta))/width)^power+(abs(sin(theta))/height)^power)^(1/power)",
    parameters: [
      parameter("width", "model.trajectory.param.halfWidth", 240),
      parameter("height", "model.trajectory.param.halfHeight", 150),
      parameter("power", "model.trajectory.param.cornerExponent", 4, 0.5, 12, 0.1),
    ],
  },
  {
    id: "random-wave",
    category: PRESET_CATEGORIES.other,
    get name(): string {
      return t("model.trajectory.preset.randomWave");
    },
    xExpression: "length*(t-0.5)",
    yExpression:
      "amplitude*(sin(2*pi*waves*t)+randomness*(0.5*sin(13*pi*t+seed)+0.3*cos(23*pi*t+2*seed)))",
    randomness: 0.5,
    parameters: [
      parameter("length", "model.trajectory.param.length", 600),
      parameter("amplitude", "model.trajectory.param.amplitude", 100),
      parameter("waves", "model.trajectory.param.primaryWaves", 2, 1, 20),
    ],
  },
  {
    id: "random-polygon",
    category: PRESET_CATEGORIES.other,
    get name(): string {
      return t("model.trajectory.preset.randomPolygon");
    },
    shape: "random-polygon",
    randomness: 0.5,
    parameters: [radiusParameter, parameter("points", "model.trajectory.param.vertices", 7, 3, 40)],
  },
  {
    id: "random-loop",
    category: PRESET_CATEGORIES.other,
    get name(): string {
      return t("model.trajectory.preset.randomLoop");
    },
    mode: "polar",
    radiusExpression:
      "radius*(1+randomness*(0.5*sin(3*theta+seed)+0.3*cos(5*theta+seed*2)+0.2*sin(7*theta+seed*3)))",
    randomness: 0.5,
    parameters: [radiusParameter],
  },
];
