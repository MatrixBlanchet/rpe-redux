/**
 * Exchange-format contracts: Phigros official JSON and PhiEdit PEC convert into
 * the RPE chart shape, and the exporters keep the basic notes and line events.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { parseExternalChartText } from "../../../core/global/chart/formats/external.ts";
import { serializeOfficialChart } from "../../../core/global/chart/formats/official.ts";
import { serializePecChart } from "../../../core/global/chart/formats/pec.ts";
import { beatValue } from "../../../core/global/chart/timing/beat.ts";

const OFFICIAL = {
  formatVersion: 3,
  offset: 0.5,
  judgeLineList: [
    {
      bpm: 120,
      notesAbove: [
        { type: 1, time: 0, holdTime: 0, positionX: 0, speed: 1, floorPosition: 0 },
        { type: 3, time: 32, holdTime: 16, positionX: 9, speed: 1, floorPosition: 2.4 },
        { type: 2, time: 64, holdTime: 0, positionX: -9, speed: 2, floorPosition: 4.8 },
        { type: 4, time: 96, holdTime: 0, positionX: 0, speed: 1, floorPosition: 7.2 },
      ],
      notesBelow: [{ type: 1, time: 128, holdTime: 0, positionX: 0, speed: 1, floorPosition: 9.6 }],
      speedEvents: [{ startTime: 0, endTime: 1000, value: 2.4 }],
      judgeLineMoveEvents: [
        { startTime: 0, endTime: 32, start: 0.5, start2: 0.5, end: 0.75, end2: 0.5 },
      ],
      judgeLineRotateEvents: [{ startTime: 0, endTime: 32, start: 0, end: 90 }],
      judgeLineDisappearEvents: [{ startTime: 0, endTime: 32, start: 1, end: 0.5 }],
    },
  ],
};

const PEC = `175
bp 0.000 120.000
cp 0 0 1024 700
cm 0 0 1 512 700 1
cd 0 0 90
ca 0 0 255
cv 0 0 17.111
n1 0 1 0 1 0
# 2.500
& 0.80
n2 0 2 3 0 1 0
# 1.000
& 1.00
n3 0 4 0 1 0
n4 0 5 0 2 1
`;

test("official JSON imports notes, coordinates, time and opacity", () => {
  const parsed = parseExternalChartText(JSON.stringify(OFFICIAL), {
    name: "Official Test",
  });
  assert.equal(parsed?.format, "official");
  const chart = parsed.chart;
  assert.equal(chart.META.name, "Official Test");
  assert.equal(chart.META.offset, 500);
  assert.equal(chart.BPMList[0].bpm, 120);
  const line = chart.judgeLineList[0];
  assert.equal(line.eventLayers[0].moveXEvents[0].start, 0);
  assert.equal(line.eventLayers[0].moveXEvents[0].end, 337.5);
  assert.equal(line.eventLayers[0].moveYEvents[0].start, 0);
  assert.equal(line.eventLayers[0].rotateEvents[0].end, -90);
  assert.equal(line.eventLayers[0].alphaEvents[0].end, 127.5);
  assert.ok(Math.abs(line.eventLayers[0].speedEvents[0].start - 10.8) < 1e-9);
  assert.deepEqual(
    line.notes.map((note) => note.type),
    [1, 2, 4, 3, 1],
  );
  assert.equal(line.notes[1].positionX, 675);
  assert.equal(beatValue(line.notes[1].startTime), 1);
  assert.equal(beatValue(line.notes[1].endTime), 1.5);
  assert.equal(line.notes[2].positionX, -675);
  assert.equal(line.notes[4].above, 2);
});

test("official formatVersion 1 decodes packed X/Y positions", () => {
  const start = Math.round(0.5 * 880) * 1000 + 0.5 * 520;
  const end = Math.round(0.75 * 880) * 1000 + 0.5 * 520;
  const parsed = parseExternalChartText(
    JSON.stringify({
      formatVersion: 1,
      offset: 0,
      judgeLineList: [
        {
          bpm: 120,
          notesAbove: [],
          notesBelow: [],
          speedEvents: [],
          judgeLineMoveEvents: [{ startTime: 0, endTime: 32, start, end }],
          judgeLineRotateEvents: [],
          judgeLineDisappearEvents: [],
        },
      ],
    }),
  ).chart;
  const move = parsed.judgeLineList[0].eventLayers[0].moveXEvents[0];
  assert.equal(move.start, 0);
  assert.equal(move.end, 337.5);
  assert.equal(parsed.judgeLineList[0].eventLayers[0].moveYEvents[0].start, 0);
});

test("official export keeps basic note and line data through a round trip", () => {
  const imported = parseExternalChartText(JSON.stringify(OFFICIAL)).chart;
  const exported = serializeOfficialChart(imported);
  const official = JSON.parse(exported.text);
  assert.equal(official.formatVersion, 3);
  assert.equal(official.offset, 0.5);
  assert.equal(official.judgeLineList.length, 1);
  assert.deepEqual(
    official.judgeLineList[0].notesAbove.map((note) => note.type),
    [1, 3, 2, 4],
  );
  assert.equal(official.judgeLineList[0].notesBelow[0].type, 1);
  assert.equal(official.judgeLineList[0].notesAbove[1].positionX, 9);
  assert.ok(official.judgeLineList[0].speedEvents.length > 0);
  assert.ok(official.judgeLineList[0].judgeLineMoveEvents.length > 0);
});

test("PEC imports line commands, note types and note continuations", () => {
  const parsed = parseExternalChartText(PEC, { name: "PEC Test" });
  assert.equal(parsed?.format, "pec");
  const chart = parsed.chart;
  assert.equal(chart.META.name, "PEC Test");
  assert.equal(chart.META.offset, 0);
  assert.equal(chart.BPMList[0].bpm, 120);
  const line = chart.judgeLineList[0];
  assert.equal(line.eventLayers[0].moveXEvents[0].start, 0);
  assert.equal(line.eventLayers[0].moveXEvents[0].end, -337.5);
  assert.equal(line.eventLayers[0].rotateEvents[0].start, 90);
  assert.equal(line.eventLayers[0].rotateEvents[0].end, 90);
  assert.equal(line.eventLayers[0].alphaEvents[0].start, 255);
  assert.ok(Math.abs(line.eventLayers[0].speedEvents[0].start - 10) < 0.001);
  assert.deepEqual(
    line.notes.map((note) => note.type),
    [1, 2, 3, 4],
  );
  assert.equal(line.notes[0].speed, 2.5);
  assert.equal(line.notes[0].size, 0.8);
  assert.equal(beatValue(line.notes[1].startTime), 2);
  assert.equal(beatValue(line.notes[1].endTime), 3);
  assert.equal(line.notes[3].above, 2);
  assert.equal(line.notes[3].isFake, 1);
});

test("PEC imports legacy alpha fades without an easing token", () => {
  const parsed = parseExternalChartText(`175
bp 0 120
ca 0 0 0
cf 0 0 2 127
ca 0 4 255
`);
  const events = parsed?.chart.judgeLineList[0].eventLayers[0].alphaEvents;
  assert.equal(parsed?.format, "pec");
  assert.equal(events?.[0]?.start, 0);
  assert.equal(events?.[0]?.end, 127);
  assert.equal(events?.[0]?.easingType, 1);
  assert.equal(beatValue(events?.[0]?.endTime), 2);
});

test("PEC export writes the basic command set and survives a re-import", () => {
  const imported = parseExternalChartText(PEC).chart;
  const exported = serializePecChart(imported);
  assert.match(exported.text, /^175/m);
  assert.match(exported.text, /^bp /m);
  assert.match(exported.text, /^cp 0 /m);
  assert.match(exported.text, /^cm 0 /m);
  assert.match(exported.text, /^cd 0 /m);
  assert.match(exported.text, /^ca 0 /m);
  assert.match(exported.text, /^n1 0 /m);
  assert.match(exported.text, /^n2 0 /m);
  assert.match(exported.text, /^n3 0 /m);
  assert.match(exported.text, /^n4 0 /m);
  const roundTrip = parseExternalChartText(exported.text);
  assert.equal(roundTrip?.format, "pec");
  assert.equal(roundTrip.chart.judgeLineList[0].notes.length, 4);
});

test("RPE JSON is left to the native document path", () => {
  const rpe = JSON.stringify({
    META: { RPEVersion: 170 },
    BPMList: [{ bpm: 120, startTime: [0, 0, 1] }],
    judgeLineList: [],
  });
  assert.equal(parseExternalChartText(rpe), null);
});
