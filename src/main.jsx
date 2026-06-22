import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Cable,
  CheckCircle2,
  Gauge,
  Pause,
  Play,
  RotateCcw,
  Ruler,
  ShieldCheck,
  SkipBack,
  SkipForward,
  Timer,
  Wrench,
  XCircle,
} from 'lucide-react';
import fmsFoxImg from './assets/fms-fox.jpg';
import sparkfunHookImg from './assets/sparkfun-10kg-bar-hook.jpg';
import sparkfunHx711Img from './assets/sparkfun-hx711.jpg';
import sparkfunTal220Img from './assets/sparkfun-tal220-10kg-bar.jpg';
import sparkfunTas501Img from './assets/sparkfun-tas501-200kg-stype.jpg';
import threeCellLayoutImg from './assets/three-cell-layout.png';
import upennForceBalanceImg from './assets/upenn-force-balance-reference.png';
import buildGuide from './buildGuide.json';
import sourcesData from './sources.json';
import './styles.css';

const slides = [
  { id: 'title', title: 'What Are Load Cells?' },
  { id: 'load-cell', title: 'A Bend Becomes a Force Reading' },
  { id: 'bridge', title: 'Inside the Cell: a Wheatstone Bridge' },
  { id: 'types', title: 'Two Bar Cells, One Drag Cell' },
  { id: 'signal', title: 'Each Cell Needs Its Own Channel' },
  { id: 'objective', title: 'Measure the Reaction Forces' },
  { id: 'reference', title: 'Real Rigs Use This Load Path' },
  { id: 'hidden-balance', title: 'Keep the Sensors Out of the Flow' },
  { id: 'three-cell', title: 'Three Cells Separate the Outputs' },
  { id: 'workbench', title: 'Parts Laid Out', scene: 'workbench' },
  { id: 'assemble', title: 'The Whole Rig, Built Step by Step', scene: 'assemble' },
  { id: 'build-guide', title: 'Build It Yourself, Step by Step' },
  { id: 'mounting', title: 'How It Mounts and Stands in the Tunnel' },
  { id: 'plan', title: 'Build Plan, Time, and Cost' },
  { id: 'sources', title: 'Sources & References' },
];

const SLIDE_WIDTH = 1094;
const SLIDE_HEIGHT = 615;

const metrics = [
  ['3.0 m', 'Fox wingspan'],
  ['0.744 m²', 'Wing area'],
  ['4.7 kg', 'Flying weight'],
  ['3 cells', 'Lift, drag, pitch'],
];

const forces = [
  { name: 'Lift', value: 'vertical force', tone: 'lift', text: 'Up/down load from the wing.' },
  { name: 'Drag', value: 'horizontal force', tone: 'drag', text: 'Backward load parallel to airflow.' },
  { name: 'Pitch', value: 'front/rear difference', tone: 'pitch', text: 'Nose-up or nose-down tendency.' },
];

const practicalUses = [
  ['Scales', 'Known weight pushes down on the cell.'],
  ['Test rigs', 'A part pulls or compresses the cell.'],
  ['Wind tunnels', 'A sting transfers aircraft loads into hidden sensors.'],
];

const cellTypes = [
  {
    title: 'TAL220 straight-bar',
    tag: '2x for lift/pitch',
    spec: '10 kg, 80 x 12.7 x 12.7 mm',
    kind: 'bar-cell',
    image: sparkfunTal220Img,
    works: 'A bar beam bends across its center. Gauges read tension on one face and compression on the other.',
    use: 'Mount two under the plate. Sum for lift; their front/rear difference gives pitch.',
  },
  {
    title: 'TAS501 S-Type',
    tag: '1x for drag',
    spec: '200 kg, 51 x 19 x 76 mm',
    kind: 's-cell',
    image: sparkfunTas501Img,
    works: 'The S-body is designed for inline tension and compression through the threaded axis.',
    use: 'Mount horizontally with rod ends so the plate pulls or pushes it along the airflow.',
  },
  {
    title: 'Hook load cell',
    tag: 'optional only',
    spec: '10 kg hanging/pull tests',
    kind: 'hook-cell',
    image: sparkfunHookImg,
    works: 'Same strain-gauge idea, packaged with hooks for hanging mass or pull-force demos.',
    use: 'Useful for simple calibration demos. Not part of the actual three-cell wind-tunnel balance.',
  },
];

const signalChain = [
  ['Load path', 'Airframe force is routed through the sting and balance plate.'],
  ['Metal strain', 'The load cell flexes a tiny, repeatable amount.'],
  ['Bridge voltage', 'Four strain gauges create a small differential signal.'],
  ['HX711 / DAQ', 'Amplifier and ADC turn millivolts into digital counts.'],
  ['Calibration', 'Known loads map counts to Newtons.'],
];

// Load cell (4 wires) lands on the HX711's bridge terminals. The HX711 makes
// its own excitation from VCC, so these four wires go to the HX711, NOT the MCU.
const cellWires = [
  ['red', 'Red', 'E+', 'Excitation +'],
  ['black', 'Black', 'E-', 'Excitation -'],
  ['green', 'Green', 'A+', 'Signal +'],
  ['white', 'White', 'A-', 'Signal -'],
];

// Only four pins leave each HX711 for the Arduino.
const hx711Pins = [
  ['VCC', '5 V', 'Board power (works 2.6-5.5 V)'],
  ['GND', 'GND', 'Common ground - tie all 3 boards together'],
  ['DT', 'Digital in', 'Serial data the HX711 sends to the Arduino'],
  ['SCK', 'Digital out', 'Clock the Arduino drives'],
];

// One amplifier per cell, each on its own pin pair (Arduino Uno example).
const channelMap = [
  ['Lift A', 'Front TAL220', '#1', 'D2', 'D3'],
  ['Lift B', 'Rear TAL220', '#2', 'D4', 'D5'],
  ['Drag', 'TAS501 S-type', '#3', 'D6', 'D7'],
];

const wiringNotes = [
  ['Shared power', 'All three VCC pins to 5 V, all three GND pins to a single common ground.'],
  ['Own clock + data', 'Each board gets its own DT and SCK pin so channels never collide.'],
  ['80 samples/s', 'Tie the RATE pin high for 80 SPS instead of 10 - smoother averaging in the tunnel.'],
  ['Quiet wiring', 'Keep the four bridge wires short and twisted; route them away from motor/ESC leads.'],
];

const loggedColumns = ['raw counts x3', 'calibrated N', 'wind speed', 'angle of attack', 'notes'];

const referenceLessons = [
  ['What to copy', 'A sting transfers model loads into a protected balance, not into sensors exposed to airflow.'],
  ['What changes here', 'The Fox setup adds a second vertical cell so lift and pitch can be separated.'],
  ['What stays practical', 'Load cells, HX711 channels, mounting plates, bolts, wiring strain relief, and calibration masses.'],
];

const buildSteps = [
  ['1', 'Fixed frame', 'Rigid 20x20 aluminum extrusion base, bolted down so it cannot flex or creep.'],
  ['2', 'Vertical cells', 'Two TAL220 bar cells ~95 mm apart, fixed end down and free end up (M4/M5 bolts).'],
  ['3', 'Moving plate', 'Stiff ~6 mm plate ties the sting to both free ends so only the cells carry load.'],
  ['4', 'Drag link', 'TAS501 inline with the airflow on rod-end clevises, seeing pure tension/compression.'],
  ['5', 'Protect + check', 'Hard stops, wire strain relief, and an alignment check before any wind-on run.'],
];

const bomRows = [
  ['2x TAL220 (lift)', '$16-24', '10 kg bars, ~$10 ea'],
  ['Drag cell 5-10 kg', '$10-15', '200 kg = overkill'],
  ['3x HX711 amps', '$18-30', 'one per cell'],
  ['Arduino Uno', '$10-25', 'reads 3 channels'],
  ['Frame + plate', '$250-$900', 'buy; varies most'],
  ['Bolts + rod-ends', '$25-$45', 'M4/M5 + heim joints'],
  ['Sting + AoA plate', '$30-$60', 'rod + angle plate'],
  ['Pitot + airspeed', '$15-$40', 'for CL / CD'],
  ['Estimated total', '~$375-$1,140', 'frame drives it'],
];

// Assembly order, built bottom-up so the load path is obvious.
const assemblySteps = [
  ['1', 'Bolt down a rigid base', 'A 2020 aluminum frame or thick plate, fastened hard to the tunnel floor or a heavy bench. It must not flex or rock.'],
  ['2', 'Fix the load cells to the base', "Both TAL220 fixed-ends bolt down (M5); the TAS501 anchors to the frame through a rod-end bearing."],
  ['3', 'Drop the moving plate on the cells', "It rests only on the bar cells' free ends, so every bit of lift passes through them."],
  ['4', 'Add the drag link', "Connect the TAS501's other end to the plate, inline with the airflow, through a rod-end."],
  ['5', 'Mount the sting + aircraft', 'Clamp the sting to the plate; it rises through a small slot in the tunnel floor; bolt the Fox on top.'],
  ['6', 'Wire, then calibrate', 'Each cell to its HX711 to the Arduino, then hang known weights to map counts to Newtons before wind-on.'],
];

// Where the whole thing physically lives.
const placementRules = [
  ['Out of the airflow', 'Only the aircraft and the thin sting see wind. Cells, plate, and wiring sit below the test section.'],
  ['Rigidly grounded', 'Base bolted or clamped to the tunnel structure or a heavy bench - never sitting loose on the floor.'],
  ['Sting through a slot', 'The sting passes up through a small floor slot; keep the slot tight so air does not leak around it.'],
];

// Make-vs-buy sourcing for every part.
const partSourcing = [
  ['Frame / base', 'Buy', '2020 aluminum extrusion + brackets (Amazon, Misumi) or a steel plate'],
  ['Moving plate', 'Make', '~6 mm aluminum, cut + drilled (SendCutSend or a local metal shop)'],
  ['2x TAL220 cells', 'Buy', 'SparkFun / Amazon / AliExpress'],
  ['TAS501 S-cell', 'Buy', 'Amazon / AliExpress'],
  ['3x HX711 amps', 'Buy', 'SparkFun SEN-13879 / Amazon'],
  ['Rod-ends + bolts', 'Buy', 'McMaster-Carr / hardware store'],
  ['Calibration weights', 'Buy', 'Known mass set (or known gym weights)'],
];

const rigNotes = {
  workbench:
    'Loose bench layout: two TAL220 lift cells, one TAS501 drag cell, three HX711 boards, moving plate, sting, rails, and hard-stop hardware. Parts are shown to scale - the bar reads 100 mm.',
  assembled:
    'Connected hidden balance: the sting loads the moving plate; vertical cells read lift/pitch and the horizontal S-beam reads drag. The rig is to scale; the 3 m glider is shrunk to fit the frame.',
  exploded:
    'Same rig pulled apart in load-path order: air load enters the aircraft, runs down the sting into the moving plate, through the load cells, into the rigid frame that is bolted down. Each number is one link in that chain.',
  'force-paths':
    'Lift is front plus rear TAL220 force. Pitch is the front/rear difference times spacing. Drag is the TAS501 force.',
};

function App() {
  const [index, setIndex] = useState(0);
  const [scale, setScale] = useState(1);
  const slide = slides[index];

  useEffect(() => {
    let frame = 0;
    const updateScale = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const availableWidth = Math.max(window.innerWidth - 56, 320);
        const availableHeight = Math.max(window.innerHeight - 104, 240);
        setScale(Math.min(availableWidth / SLIDE_WIDTH, availableHeight / SLIDE_HEIGHT));
      });
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    window.visualViewport?.addEventListener('resize', updateScale);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', updateScale);
      window.visualViewport?.removeEventListener('resize', updateScale);
    };
  }, []);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'ArrowRight' || event.key === ' ') {
        event.preventDefault();
        setIndex((value) => Math.min(slides.length - 1, value + 1));
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setIndex((value) => Math.max(0, value - 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const deckStyle = {
    '--deck-scale': scale,
    '--deck-width': `${SLIDE_WIDTH}px`,
    '--deck-height': `${SLIDE_HEIGHT}px`,
    '--scaled-width': `${SLIDE_WIDTH * scale}px`,
    '--scaled-height': `${SLIDE_HEIGHT * scale}px`,
  };

  return (
    <main className="deck" style={deckStyle}>
      <section className="slide-frame" aria-live="polite">
        <section className="slide-stage">
          <SlideBody slide={slide} />
        </section>
      </section>
      <footer className="slide-nav">
        <button
          aria-label="Previous slide"
          disabled={index === 0}
          onClick={() => setIndex((value) => Math.max(0, value - 1))}
        >
          <ArrowLeft size={20} />
        </button>
        <div className="slide-count">
          {index + 1} / {slides.length}
        </div>
        <button
          aria-label="Next slide"
          disabled={index === slides.length - 1}
          onClick={() => setIndex((value) => Math.min(slides.length - 1, value + 1))}
        >
          <ArrowRight size={20} />
        </button>
      </footer>
    </main>
  );
}

function SlideBody({ slide }) {
  if (slide.id === 'title') return <TitleSlide />;
  if (slide.id === 'objective') return <ObjectiveSlide />;
  if (slide.id === 'load-cell') return <LoadCellSlide />;
  if (slide.id === 'signal') return <SignalSlide />;
  if (slide.id === 'types') return <TypesSlide />;
  if (slide.id === 'reference') return <ReferenceSlide />;
  if (slide.id === 'hidden-balance') return <HiddenBalanceSlide />;
  if (slide.id === 'three-cell') return <ThreeCellSlide />;
  if (slide.id === 'workbench') return <ModelSlide slide={slide} />;
  if (slide.id === 'assemble') return <AssemblySlide />;
  if (slide.id === 'build-guide') return <BuildGuideSlide />;
  if (slide.id === 'bridge') return <BridgeSlide />;
  if (slide.id === 'build') return <BuildSetupSlide />;
  if (slide.id === 'mounting') return <MountingSlide />;
  if (slide.id === 'connections') return <ConnectionMapSlide />;
  if (slide.id === 'sourcing') return <MakeBuySlide />;
  if (slide.id === 'wiring') return <WiringSlide />;
  if (slide.id === 'pinmap') return <PinMapSlide />;
  if (slide.id === 'calibration') return <CalibrationSlide />;
  if (slide.id === 'sources') return <SourcesSlide />;
  return <PlanSlide />;
}

function SlideShell({ title, kicker, children, className = '' }) {
  return (
    <article className={`slide slide-shell ${className}`}>
      <header className="slide-header">
        <p>{kicker}</p>
        <h1>{title}</h1>
      </header>
      <div className="slide-body">{children}</div>
    </article>
  );
}

function TitleSlide() {
  return (
    <article className="slide title-slide">
      <div className="title-copy">
        <p className="kicker">Wind-tunnel force measurement</p>
        <h1>What Are Load Cells?</h1>
        <p className="lede">
          They are force sensors. In this setup, they sit outside the airflow and turn the Fox glider's lift, drag, and pitch loads into calibrated data.
        </p>
      </div>
      <div className="hero-visual">
        <img className="fox-image" src={fmsFoxImg} alt="FMS Fox 3000mm glider" />
        <div className="hero-part hero-part-a">
          <img src={sparkfunTal220Img} alt="TAL220 straight-bar load cell" />
          <span>Lift cells</span>
        </div>
        <div className="hero-part hero-part-b">
          <img src={sparkfunTas501Img} alt="TAS501 S-Type load cell" />
          <span>Drag cell</span>
        </div>
      </div>
      <MetricStrip items={metrics} />
    </article>
  );
}

function ObjectiveSlide() {
  return (
    <SlideShell title="What the Balance Must Measure" kicker="Fox glider in the wind tunnel">
      <div className="objective-grid">
        <div className="aircraft-panel">
          <span className="airflow-label">Airflow</span>
          <img src={fmsFoxImg} alt="FMS Fox 3000mm glider" />
          <div className="force-line force-lift">Lift</div>
          <div className="force-line force-drag">Drag</div>
          <div className="force-line force-pitch">Pitch</div>
        </div>
        <div className="force-stack">
          {forces.map((force) => (
            <ForceCard key={force.name} force={force} />
          ))}
        </div>
      </div>
    </SlideShell>
  );
}

function LoadCellSlide() {
  return (
    <SlideShell title="A Bend Becomes a Force Reading" kicker="Force sensor, practical version">
      <div className="load-explainer">
        <div className="cell-cutaway">
          <img src={sparkfunTal220Img} alt="TAL220 straight-bar load cell" />
          <div className="load-arrow load-arrow-down">Applied force</div>
          <div className="load-arrow load-arrow-out">Signal to amplifier</div>
        </div>
        <div className="explainer-stack">
          <p className="big-statement">A load cell is a machined metal spring with strain gauges attached inside.</p>
          <div className="process-strip">
            <AxisCard title="1. Force enters" text="The mount pushes or pulls on the load cell through one intended axis." tone="lift" />
            <AxisCard title="2. Metal flexes" text="The body bends by a tiny amount, then springs back." tone="drag" />
            <AxisCard title="3. Voltage changes" text="The strain gauges change resistance, creating a small signal the HX711 can read." tone="pitch" />
          </div>
          <div className="use-strip">
            {practicalUses.map((item) => (
              <div key={item[0]}>
                <strong>{item[0]}</strong>
                <span>{item[1]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SlideShell>
  );
}

function SignalSlide() {
  return (
    <SlideShell title="Each Cell Needs Its Own Channel" kicker="Practical signal chain">
      <div className="signal-layout">
        <div className="signal-photo">
          <img src={sparkfunHx711Img} alt="SparkFun HX711 load cell amplifier" />
          <p>One amplifier/ADC channel per load cell keeps lift A, lift B, and drag separated.</p>
        </div>
        <div className="signal-chain">
          {signalChain.map((step, index) => (
            <div className="signal-node" key={step[0]}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div>
                <h2>{step[0]}</h2>
                <p>{step[1]}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </SlideShell>
  );
}

function TypesSlide() {
  return (
    <SlideShell title="Two Bar Cells, One Drag Cell" kicker="Two are required; one is optional">
      <div className="sensor-cards">
        {cellTypes.map((cell) => (
          <SensorRow key={cell.title} cell={cell} />
        ))}
      </div>
    </SlideShell>
  );
}

function ReferenceSlide() {
  return (
    <SlideShell title="Real Rigs Use This Load Path" kicker="Reference build pattern">
      <div className="reference-layout">
        <figure className="reference-photo">
          <img src={upennForceBalanceImg} alt="Low-cost wind tunnel force balance reference build" />
          <figcaption>Reference force-balance build: top plate, sting, hidden load cells, HX711 wiring.</figcaption>
        </figure>
        <div className="reference-lessons">
          {referenceLessons.map(([title, text]) => (
            <article key={title}>
              <strong>{title}</strong>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </div>
    </SlideShell>
  );
}

function HiddenBalanceSlide() {
  return (
    <SlideShell title="Keep the Sensors Out of the Flow" kicker="The sting is visible; the balance is hidden">
      <div className="hidden-layout">
        <div className="path-card">
          <h2>Actual force path</h2>
          <ForcePath />
        </div>
        <div className="good-bad">
          <SetupRule icon={CheckCircle2} title="Good setup" text="Only the aircraft and a smooth sting are in the test flow. Load cells, wires, and electronics sit below or behind the test section." tone="good" />
          <SetupRule icon={AlertTriangle} title="Bad setup" text="Sensors, brackets, and wires exposed to airflow create fake drag that changes with speed and angle." tone="bad" />
        </div>
      </div>
    </SlideShell>
  );
}

function ThreeCellSlide() {
  return (
    <SlideShell title="Three Cells Separate the Outputs" kicker="Actual balance layout">
      <div className="three-cell-grid">
        <figure className="source-diagram">
          <img src={threeCellLayoutImg} alt="Three-cell lift drag and pitching moment layout" />
          <figcaption>Two vertical cells carry the plate; one horizontal cell reads drag.</figcaption>
        </figure>
        <div className="output-panel">
          <div className="output-chip lift">
            <strong>Lift</strong>
            <span>front vertical cell plus rear vertical cell</span>
          </div>
          <div className="output-chip pitch">
            <strong>Pitch</strong>
            <span>difference between front and rear vertical cells</span>
          </div>
          <div className="output-chip drag">
            <strong>Drag</strong>
            <span>horizontal S-Type cell only</span>
          </div>
          <p>
            For the Fox: two vertical bar cells give lift and pitch, one horizontal S-Type cell gives drag. The hook cell is not used here.
          </p>
        </div>
      </div>
    </SlideShell>
  );
}

const modelKickers = {
  workbench: 'Loose parts',
  assembled: 'Connected rig',
  exploded: 'Load-path order',
};

function ModelSlide({ slide }) {
  return (
    <article className="slide model-slide">
      <RigCanvas sceneMode={slide.scene} />
      <div className="model-caption">
        <p>{modelKickers[slide.id] || 'Connected rig'}</p>
        <h1>{slide.title}</h1>
        <span>{rigNotes[slide.id]}</span>
      </div>
      <div className="model-hint">Drag to rotate &middot; scroll to zoom</div>
    </article>
  );
}

// ===========================================================================
// Interactive animated assembly.
// The rig builds itself part-by-part in real load-path order. Each part flies
// from a staging offset into its final place and "snaps" in (a pulse ring), and
// the real 4-wire bridge cables + DT/SCK jumpers draw themselves in. One single
// continuous "scrub" value (0..9) drives the entire reveal, so nothing is ever
// rebuilt when the step changes - we only move groups and grow wire draw-ranges
// inside the render loop. Captions below were fact-checked against the rig's
// engineering facts (cantilever fixed-end-down / free-end-up, bridge wire
// colours, the HX711 pin map, the load path).
// ===========================================================================

// One caption per step. Index 0 = intro, 9 = final wiring.
const assemblyStepCaptions = [
  {
    kicker: 'START HERE',
    title: 'A Force Balance, From Scratch',
    body: "An empty tunnel with a frame bolted to the floor. We'll build the balance - a force-measuring rig - one piece at a time. Press Play.",
    fastener: 'Press Play, or step through with Next',
  },
  {
    kicker: 'FRAME',
    title: 'Bolt the Base Down Hard',
    body: "The rigid 2020-aluminium frame bolts to the tunnel stand. It's the foundation of the load path, so it must not flex or rock.",
    fastener: 'Frame bolted hard to the stand - no flex',
  },
  {
    kicker: 'FRONT LIFT',
    title: 'Front Lift Cell (TAL220 #1)',
    body: 'Bolt the fixed end DOWN to the base (M5); the free end goes UP to the plate (M4). Spacers leave a flex gap - bolt both ends flat and it reads zero.',
    fastener: 'Fixed end: M5 + spacer down  ·  free end: M4 + spacer up',
  },
  {
    kicker: 'REAR LIFT',
    title: 'Rear Lift Cell (TAL220 #2)',
    body: 'A second 10 kg bar cell ~95 mm behind the front. That spacing is the moment arm (lever distance) that turns front-minus-rear into pitch.',
    fastener: 'M5 + spacer down to base  ·  M4 + spacer up to plate',
  },
  {
    kicker: 'MOVING PLATE',
    title: 'Plate on a Drag-Axis Slide',
    body: "The plate bolts to the two free ends through a mini linear slide: rigid vertically so all lift flows through the cells, but free to slide fore-aft so drag can reach the S-cell. Nothing else may touch it.",
    fastener: 'M4 bolts -> carriages on a drag-axis linear guide',
  },
  {
    kicker: 'DRAG CELL',
    title: 'TAS501 S-Cell Reads Drag',
    body: 'The S-type cell mounts horizontally, inline with the airflow, between frame and plate on rod-end (heim) bearings - so it feels only the along-wind push.',
    fastener: 'Rod-end (heim) bearings + shoulder bolts',
  },
  {
    kicker: 'STING',
    title: 'Sting Lifts the Model Into the Air',
    body: "A clamp block bolts to the plate's centre; the thin sting rises through a floor slot. Only the aircraft and the sting ever meet the air.",
    fastener: 'Clamp block bolted to the plate centre',
  },
  {
    kicker: 'FOX GLIDER',
    title: 'Airframe Bolts to the Sting',
    body: 'The FMS Fox bolts to the sting saddle. Air load enters here and flows straight down the sting into the balance below.',
    fastener: 'Saddle bolts clamp the airframe to the sting top',
  },
  {
    kicker: 'WIRING',
    title: 'Each Cell to Its Own HX711',
    body: "Every cell's 4 sealed bridge wires run straight to its own HX711 amp (it boosts the tiny signal). Three cells, three boards, no breadboard.",
    fastener: 'red E+ · black E- · green A+ · white A-  to HX711',
  },
  {
    kicker: 'TO ARDUINO',
    title: 'HX711 to Arduino, Three Channels',
    body: 'Each HX711 sends data (DT) and clock (SCK) to its own pin pair. All share 5 V and a common ground; tie RATE high for 80 SPS.',
    fastener: 'DT/SCK: D2/D3 · D4/D5 · D6/D7  ·  shared 5V/GND',
  },
];

const ASSEMBLY_LAST_STEP = assemblyStepCaptions.length - 1; // 9

function clamp01(value) {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

// Smoothstep ease-in-out: slow start, slow finish, so each part eases into place.
function smoothEase(p) {
  return p * p * (3 - 2 * p);
}

function AssemblySlide() {
  // React owns only the DISPLAY state (caption + button states). The canvas owns
  // the animation and pushes the current step/playing back up through onState.
  const [view, setView] = useState({ step: 0, playing: false });
  const controllerRef = useRef(null);
  const caption = assemblyStepCaptions[view.step];

  const press = (method) => () => {
    const controller = controllerRef.current;
    if (controller && controller[method]) controller[method]();
  };

  const playLabel = view.playing
    ? 'Pause'
    : view.step === 0
    ? 'Play'
    : view.step === ASSEMBLY_LAST_STEP
    ? 'Replay'
    : 'Resume';

  return (
    <article className="slide model-slide assembly-slide">
      <AssemblyCanvas controllerRef={controllerRef} onState={setView} />

      <div className="model-caption assembly-caption">
        <p>
          Animated build &middot; step {view.step} / {ASSEMBLY_LAST_STEP}
        </p>
        <h1>{caption.title}</h1>
        <span>{caption.body}</span>
        <div className="assembly-fastener">
          <Wrench size={14} />
          <strong>{caption.fastener}</strong>
        </div>
        <div className="assembly-progress" aria-hidden="true">
          <span style={{ width: `${(view.step / ASSEMBLY_LAST_STEP) * 100}%` }} />
        </div>
      </div>

      <div className="assembly-controls">
        <button onClick={press('prev')} disabled={view.step === 0} aria-label="Previous step">
          <SkipBack size={18} />
        </button>
        <button className="primary" onClick={press('togglePlay')} aria-label={view.playing ? 'Pause' : 'Play'}>
          {view.playing ? <Pause size={18} /> : <Play size={18} />}
          <span>{playLabel}</span>
        </button>
        <button onClick={press('next')} disabled={view.step === ASSEMBLY_LAST_STEP} aria-label="Next step">
          <SkipForward size={18} />
        </button>
        <button onClick={press('reset')} disabled={view.step === 0 && !view.playing} aria-label="Reset to start">
          <RotateCcw size={16} />
        </button>
      </div>

      <div className="model-hint">Drag to rotate &middot; scroll to zoom</div>
    </article>
  );
}

function AssemblyCanvas({ controllerRef, onState }) {
  const mountRef = useRef(null);
  // Keep the latest onState callback reachable from the long-lived render loop
  // without re-running the build effect.
  const onStateRef = useRef(onState);
  onStateRef.current = onState;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    // --- renderer / scene / camera / lights (mirrors RigCanvas) -------------
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf7fbff);

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;
    scene.environmentIntensity = 0.5;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    scene.add(new THREE.HemisphereLight(0xffffff, 0xb8cad8, 1.6));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.1);
    keyLight.position.set(4.5, 5, 3);
    scene.add(keyLight);
    const rim = new THREE.DirectionalLight(0x9bdcff, 1.0);
    rim.position.set(-4, 1.8, -3);
    scene.add(rim);

    const root = new THREE.Group();
    root.position.set(0, -0.08, 0);
    scene.add(root);

    const mats = makeMaterials('assembly');
    const { animated, cables, labels, pulses } = buildAssemblyScene(root, mats);

    // Auto-fit the camera ONCE to the fully assembled rig (every part at its
    // 'to' position), so parts fly in from just outside the final silhouette and
    // the framing never jumps between steps.
    animated.forEach((part) => part.group.position.copy(part.to));
    frameSceneToCamera(camera, controls, root);
    // Pull in a touch tighter than the generic fit so the balance + wiring fill
    // the frame on this teaching slide.
    camera.position.lerp(controls.target, 0.12);
    camera.updateProjectionMatrix();
    controls.update();

    // --- animation state machine --------------------------------------------
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const EASE_MS = 950; // time to fly a single part fully into place
    const dwellFor = (step) => (step >= 8 ? 1150 : 850); // pause so the caption reads
    let scrub = 0; // continuous build position, 0 .. ASSEMBLY_LAST_STEP
    let target = 0; // the integer step we are easing toward
    let playing = false;
    let dwell = 0;
    let doneLatched = false;
    let last = performance.now();

    const pushState = () => {
      if (onStateRef.current) onStateRef.current({ step: target, playing });
    };

    // Place every part / cable / pulse for a given scrub position.
    const applyScrub = (s) => {
      for (const part of animated) {
        const p = clamp01(s - (part.appearAt - 1));
        const e = smoothEase(p);
        part.group.position.set(
          THREE.MathUtils.lerp(part.from.x, part.to.x, e),
          THREE.MathUtils.lerp(part.from.y, part.to.y, e),
          THREE.MathUtils.lerp(part.from.z, part.to.z, e)
        );
        // Hide a part until its own fly-in begins, so finished steps stay tidy.
        part.group.visible = s > part.appearAt - 1 + 0.012;
      }
      for (const cable of cables) {
        const p = clamp01(s - (cable.appearAt - 1));
        const total = cable.geometry.index ? cable.geometry.index.count : 0;
        cable.mesh.visible = p > 0.001;
        cable.geometry.setDrawRange(0, Math.floor(total * p)); // wires "draw" in
      }
      for (const pulse of pulses) {
        const p = clamp01(s - (pulse.appearAt - 1));
        if (p > 0.62 && p < 0.999) {
          const t = (p - 0.62) / 0.38; // 0..1 across the final seating
          pulse.mesh.visible = true;
          pulse.mesh.scale.setScalar(0.5 + t * 1.5);
          pulse.material.opacity = Math.sin(t * Math.PI) * 0.85; // flash then fade
        } else {
          pulse.mesh.visible = false;
        }
      }
      for (const label of labels) {
        label.node.visible = s > label.appearAt - 0.5;
      }
    };

    applyScrub(0);
    pushState();

    const renderNow = () => {
      controls.update();
      renderer.render(scene, camera);
    };
    // If the tab is backgrounded, requestAnimationFrame is paused, so the easing
    // loop is frozen. Snap straight to the target and repaint once so the view
    // still reflects the current step instead of going blank/stale.
    const settleIfHidden = () => {
      if (document.hidden) {
        scrub = target;
        applyScrub(scrub);
        renderNow();
      }
    };

    // Imperative controller used by the React control bar.
    controllerRef.current = {
      next() {
        if (target < ASSEMBLY_LAST_STEP) {
          target += 1;
          dwell = 0;
          pushState();
          settleIfHidden();
        }
      },
      prev() {
        if (target > 0) {
          target -= 1;
          dwell = 0;
          pushState();
          settleIfHidden();
        }
      },
      reset() {
        target = 0;
        scrub = 0; // snap straight back to the start
        playing = false;
        dwell = 0;
        doneLatched = false;
        pushState();
        settleIfHidden();
      },
      togglePlay() {
        const willPlay = !playing;
        playing = willPlay;
        // Pressing Play after the build finished replays from the top.
        if (willPlay && target >= ASSEMBLY_LAST_STEP) {
          target = 0;
          scrub = 0;
          doneLatched = false;
        }
        dwell = 0;
        pushState();
        settleIfHidden();
      },
    };

    // Size the canvas BEFORE the first render so the opening frame is correct
    // and repaints immediately (it must not depend on the rAF loop, which is
    // paused while the tab is backgrounded).
    const resize = () => {
      const width = mount.clientWidth || 800;
      const height = mount.clientHeight || 600;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    let frame = 0;
    const animate = (now) => {
      frame = requestAnimationFrame(animate);
      const dt = Math.min(now - last, 60);
      last = now;

      // Ease the scrub toward the integer target.
      const diff = target - scrub;
      if (reduceMotion) {
        scrub = target;
      } else if (Math.abs(diff) > 0.0005) {
        const move = (dt / EASE_MS) * Math.sign(diff);
        scrub = Math.abs(move) >= Math.abs(diff) ? target : scrub + move;
      } else {
        scrub = target;
      }

      // When settled on a step during playback, dwell then auto-advance.
      if (playing && scrub === target) {
        dwell += dt;
        if (dwell >= dwellFor(target)) {
          dwell = 0;
          if (target < ASSEMBLY_LAST_STEP) {
            target += 1;
            pushState();
          } else if (!doneLatched) {
            playing = false;
            doneLatched = true;
            pushState();
          }
        }
      }

      applyScrub(scrub);
      controls.update();
      renderer.render(scene, camera);
    };
    animate(last);

    // --- cleanup (mirrors RigCanvas) ----------------------------------------
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      envTexture.dispose();
      pmrem.dispose();
      renderer.dispose();
      scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) object.material.forEach((m) => m.dispose());
          else object.material.dispose();
        }
      });
      mount.removeChild(renderer.domElement);
      controllerRef.current = null;
    };
  }, [controllerRef]);

  return <div className="canvas-host" ref={mountRef} />;
}

// Builds the rig and returns the pieces the render loop animates:
//   animated - part groups that fly in (group, to, from, appearAt)
//   cables   - wire meshes whose drawRange grows as they connect
//   pulses   - "snap" rings that flash as a part seats
//   labels   - 3D callouts that pop in with their part
function buildAssemblyScene(root, mats) {
  const animated = [];
  const cables = [];
  const labels = [];
  const pulses = [];
  const vec = (x, y, z) => new THREE.Vector3(x, y, z);

  // Register an animated part: starts at (to + fromOffset), flies to (to).
  const addPart = (group, to, fromOffset, appearAt) => {
    root.add(group);
    const toVec = vec(to[0], to[1], to[2]);
    animated.push({
      group,
      to: toVec,
      from: toVec.clone().add(vec(fromOffset[0], fromOffset[1], fromOffset[2])),
      appearAt,
    });
    return group;
  };

  // A pulse ring at a connection point, with its own material so its opacity can
  // be animated independently as the part seats.
  const addPulse = (pos, normalAxis, color, appearAt) => {
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.018, 10, 28), material);
    mesh.position.set(pos[0], pos[1], pos[2]);
    if (normalAxis === 'y') mesh.rotation.x = -Math.PI / 2;
    if (normalAxis === 'x') mesh.rotation.y = Math.PI / 2;
    mesh.visible = false;
    mesh.renderOrder = 12;
    mesh.userData.fitIgnore = true;
    root.add(mesh);
    pulses.push({ mesh, material, appearAt });
  };

  // A wire whose drawRange grows from 0 -> full while its step plays.
  const addWire = (points, material, radius, appearAt) => {
    const mesh = addTubeWire(root, points, material, radius);
    cables.push({ mesh, geometry: mesh.geometry, appearAt });
  };

  // A 3D callout that becomes visible with its step.
  const addStepLabel = (text, pos, color, appearAt) => {
    const node = new THREE.Group();
    addLabel(node, text, pos, color);
    root.add(node);
    labels.push({ node, appearAt });
  };

  // ----- local hardware builders (real fasteners so nothing looks floating) --
  // A hex-head bolt, built head-up / shank-down; `dir` re-orients it.
  const addBolt = (parent, pos, dir, shankLen, headColor) => {
    const g = new THREE.Group();
    const headMat = headColor
      ? new THREE.MeshStandardMaterial({ color: headColor, metalness: 0.8, roughness: 0.4 })
      : mats.steel;
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.016, 6), headMat);
    head.position.y = 0.008;
    const shank = new THREE.Mesh(new THREE.CylinderGeometry(0.0095, 0.0095, shankLen, 10), mats.steel);
    shank.position.y = -shankLen / 2;
    head.castShadow = true;
    shank.castShadow = true;
    g.add(head, shank);
    if (dir === 'up') g.rotation.x = Math.PI;
    else if (dir === 'x') g.rotation.z = -Math.PI / 2;
    else if (dir === '-x') g.rotation.z = Math.PI / 2;
    else if (dir === 'z') g.rotation.x = Math.PI / 2;
    else if (dir === '-z') g.rotation.x = -Math.PI / 2;
    g.position.set(pos[0], pos[1], pos[2]);
    parent.add(g);
    return g;
  };
  // A short standoff/spacer column (free end of a cell -> plate).
  const addStandoff = (parent, pos, height) =>
    addCylinder(parent, [0.034, 0.04, height], pos, mats.aluminum, 'y');
  // A rod-end (heim) bearing: a steel ball in an eye, used on the drag link.
  const addRodEnd = (parent, pos) => {
    addScaledSphere(parent, [0.035, 0.035, 0.035], pos, mats.steel);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.013, 10, 20), mats.darkMetal);
    ring.position.set(pos[0], pos[1], pos[2]);
    ring.rotation.x = Math.PI / 2;
    parent.add(ring);
  };

  // ----- vertical layout (1 unit = 100 mm). The balance hangs BELOW the tunnel
  //       floor; only the aircraft + the thin sting sit above it in the air. ---
  const GROUND_Y = -0.82; // heavy baseplate / bench top (bolted to the room)
  const FRAME_Y = -0.66; // balance frame rails, just above the baseplate
  const CELL_Y = -0.46; // bar cells, horizontal
  const CELL_TOP = CELL_Y + 0.0635;
  const CELL_BOT = CELL_Y - 0.0635;
  const PLATE_Y = -0.3; // moving plate, resting on the cell free ends
  const PLATE_BOT = PLATE_Y - 0.025;
  const FLOOR_Y = 0.12; // tunnel floor; everything below it is the balance
  const STING_Y = 0.18; // sting group origin (clamp at plate, saddle up top)
  const AIR_Y = 0.74; // aircraft, up in the airflow

  // ===== STATIC CONTEXT (always visible, ignored by the camera auto-fit) =====
  const stage = new THREE.Group();
  stage.userData.fitIgnore = true;
  root.add(stage);

  // Heavy baseplate / bench the whole rig is bolted to, + corner hold-downs.
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x6b7886, roughness: 0.78, metalness: 0.15 });
  addBox(stage, [3.3, 0.06, 1.85], [0.45, GROUND_Y, 0], baseMat);
  [[-0.95, 0.78], [1.85, 0.78], [-0.95, -0.78], [1.85, -0.78]].forEach(([x, z]) =>
    addBolt(stage, [x, GROUND_Y + 0.035, z], 'down', 0.05, 0x20262d)
  );

  // Wind-tunnel test section: a slotted floor on four legs, translucent glass
  // side walls + a wire ceiling, open at the inlet/outlet for the airflow.
  const floorMat = new THREE.MeshStandardMaterial({ color: 0xdceefb, roughness: 0.5, metalness: 0.05, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xbfe6ff, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.12, side: THREE.DoubleSide });
  const TX0 = -1.15, TX1 = 1.15, TZ = 0.86, TCEIL = FLOOR_Y + 1.25;
  const SLOT_X0 = -0.2, SLOT_X1 = 0.04, SLOT_Z0 = -0.1, SLOT_Z1 = 0.1; // sting hole
  const floorPanel = (x0, x1, z0, z1) =>
    addBox(stage, [x1 - x0, 0.04, z1 - z0], [(x0 + x1) / 2, FLOOR_Y, (z0 + z1) / 2], floorMat);
  floorPanel(TX0, SLOT_X0, -TZ, TZ); // floor left of the slot
  floorPanel(SLOT_X1, TX1, -TZ, TZ); // floor right of the slot
  floorPanel(SLOT_X0, SLOT_X1, SLOT_Z1, TZ); // floor in front of the slot
  floorPanel(SLOT_X0, SLOT_X1, -TZ, SLOT_Z0); // floor behind the slot
  // glass side walls + wire ceiling outline
  addBox(stage, [TX1 - TX0, TCEIL - FLOOR_Y, 0.02], [(TX0 + TX1) / 2, (FLOOR_Y + TCEIL) / 2, TZ], glassMat);
  addBox(stage, [TX1 - TX0, TCEIL - FLOOR_Y, 0.02], [(TX0 + TX1) / 2, (FLOOR_Y + TCEIL) / 2, -TZ], glassMat);
  const ceil = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(TX1 - TX0, 0.01, TZ * 2)),
    new THREE.LineBasicMaterial({ color: 0x9bc8e2, transparent: true, opacity: 0.7 })
  );
  ceil.position.set((TX0 + TX1) / 2, TCEIL, 0);
  stage.add(ceil);
  // four legs holding the test section up off the baseplate
  [[TX0 + 0.1, TZ - 0.1], [TX1 - 0.1, TZ - 0.1], [TX0 + 0.1, -TZ + 0.1], [TX1 - 0.1, -TZ + 0.1]].forEach(([x, z]) =>
    addBox(stage, [0.06, FLOOR_Y - GROUND_Y, 0.06], [x, (FLOOR_Y + GROUND_Y) / 2, z], mats.darkMetal)
  );
  // a label on the floor slot + the airflow arrow/label (above the floor)
  addForceArrow(stage, [-1.5, FLOOR_Y + 0.5, -0.55], [1, 0, 0], 0.7, 0x129fd2);
  addLabel(stage, 'airflow', [-1.0, FLOOR_Y + 0.66, -0.55], '#17799d');
  addLabel(stage, 'wind-tunnel test section', [0.55, TCEIL + 0.06, 0], '#17799d');
  addLabel(stage, 'balance sits below the floor', [-1.18, -0.34, 0.55], '#5e7184');

  // ===== ANIMATED BUILD =====================================================
  // 1) Rigid balance frame on the baseplate: rails + 4 bolted feet + the central
  //    pedestal the bar cells bolt down onto. Rises into place from below.
  const frame = new THREE.Group();
  addBox(frame, [1.74, 0.07, 0.07], [0, FRAME_Y, 0.34], mats.aluminum);
  addBox(frame, [1.74, 0.07, 0.07], [0, FRAME_Y, -0.34], mats.aluminum);
  addBox(frame, [0.07, 0.07, 0.68], [-0.82, FRAME_Y, 0], mats.aluminum);
  addBox(frame, [0.07, 0.07, 0.68], [0.82, FRAME_Y, 0], mats.aluminum);
  // four feet down to the baseplate, each bolted through
  [[-0.82, 0.34], [0.82, 0.34], [-0.82, -0.34], [0.82, -0.34]].forEach(([x, z]) => {
    addBox(frame, [0.1, FRAME_Y - GROUND_Y, 0.1], [x, (FRAME_Y + GROUND_Y) / 2, z], mats.darkMetal);
    addBolt(frame, [x, FRAME_Y + 0.04, z], 'down', 0.06, 0x20262d);
  });
  // central pedestal: the rigid mount the two cells' FIXED ends bolt down to.
  // Spans from the frame rail top up to the cells' underside (positive height).
  const pedBot = FRAME_Y + 0.035; // frame rail top
  const pedTop = CELL_BOT; // cells' underside
  addBox(frame, [0.4, pedTop - pedBot, 0.62], [0, (pedTop + pedBot) / 2, 0], mats.darkMetal);
  // drag-anchor post on the +X side (rod-end of the S-cell attaches here)
  addBox(frame, [0.08, PLATE_Y - FRAME_Y + 0.12, 0.08], [1.42, (PLATE_Y + FRAME_Y) / 2 + 0.06, -0.28], mats.aluminum);
  addPart(frame, [0, 0, 0], [0, -0.9, 0], 1);
  addPulse([-0.82, FRAME_Y + 0.04, 0.34], 'y', 0x2a9d5a, 1);

  // A mini LINEAR GUIDE between a cell's free end and the moving plate: STIFF
  // vertically (lift transfers into the cell) but FREE to slide along X (the drag
  // axis), so the plate can translate fore-aft to load the S-cell. Without this,
  // a plate bolted rigidly to two vertical cantilevers could not move and drag
  // would never reach the S-cell. Built in world coords on an UN-rotated wrapper.
  const addComplianceGuide = (parent, x, z) => {
    addCylinder(parent, [0.03, 0.036, 0.022], [x, CELL_TOP + 0.011, z], mats.aluminum, 'y'); // standoff off the cell
    addRoundedBox(parent, [0.18, 0.02, 0.055], [x, CELL_TOP + 0.032, z], mats.darkMetal, 0.004); // rail, long axis = X (drag)
    addBox(parent, [0.18, 0.006, 0.014], [x, CELL_TOP + 0.043, z], mats.steel); // bright groove = the slide axis
    addRoundedBox(parent, [0.08, 0.03, 0.075], [x, CELL_TOP + 0.06, z], mats.aluminum, 0.006); // carriage (plate bolts here)
  };
  // The cell's printed LOAD-DIRECTION ARROW (it, not the hole size, sets which
  // end is fixed). Drawn as a small green arrow, toggled in with its step.
  const addLoadArrow = (x, z, appearAt) => {
    const g = new THREE.Group();
    addForceArrow(g, [x, CELL_TOP + 0.17, z], [0, -1, 0], 0.13, 0x2a9d5a);
    root.add(g);
    labels.push({ node: g, appearAt });
  };

  // 2) Front lift cell - a horizontal cantilever, built in a WRAPPER so its
  //    mounting hardware is not rotated/offset with the cell. FIXED (inner) end
  //    bolts DOWN to the central pedestal; FREE (outer) end carries the linear
  //    guide up to the plate.
  const frontWrap = new THREE.Group();
  const frontCell = withRealModel('tal220', createBeamLoadCell(mats, 'front'));
  frontCell.rotation.z = -Math.PI / 2;
  frontCell.position.set(-0.3, CELL_Y, 0.14);
  frontWrap.add(frontCell);
  addBolt(frontWrap, [0.06, CELL_TOP, 0.14], 'down', 0.12, 0x20262d); // fixed end -> pedestal
  addComplianceGuide(frontWrap, -0.66, 0.14); // free end -> plate via the drag-axis slide
  addPart(frontWrap, [0, 0, 0], [-0.55, -0.6, 0.5], 2);
  addLoadArrow(-0.3, 0.14, 2);
  addPulse([0.06, CELL_TOP + 0.02, 0.14], 'y', 0x1479c9, 2);

  // 3) Rear lift cell - mirror of the front (free end aft); the ~95 mm front/rear
  //    gap is the moment arm that becomes pitch.
  const rearWrap = new THREE.Group();
  const rearCell = withRealModel('tal220', createBeamLoadCell(mats, 'rear'));
  rearCell.rotation.z = -Math.PI / 2;
  rearCell.position.set(0.3, CELL_Y, -0.14);
  rearWrap.add(rearCell);
  addBolt(rearWrap, [-0.06, CELL_TOP, -0.14], 'down', 0.12, 0x20262d);
  addComplianceGuide(rearWrap, 0.66, -0.14);
  addPart(rearWrap, [0, 0, 0], [0.55, -0.6, 0.5], 3);
  addLoadArrow(0.3, -0.14, 3);
  addPulse([-0.06, CELL_TOP + 0.02, -0.14], 'y', 0x33aaf3, 3);

  // 4) Moving plate - lands on the two guide carriages and bolts DOWN into each.
  //    It floats on the cells + sting; the guides let it slide in the drag axis.
  //    Wrapped so its bolts aren't double-offset by the plate's own position.
  const plateWrap = new THREE.Group();
  const plate = createMovingPlate(mats);
  plate.position.set(0, PLATE_Y, 0);
  plateWrap.add(plate);
  addBolt(plateWrap, [-0.66, PLATE_Y + 0.03, 0.14], 'down', 0.075, 0x20262d);
  addBolt(plateWrap, [0.66, PLATE_Y + 0.03, -0.14], 'down', 0.075, 0x20262d);
  addPart(plateWrap, [0, 0, 0], [0, 1.0, 0], 4);
  addPulse([-0.66, PLATE_Y, 0.14], 'y', 0x1479c9, 4);
  addPulse([0.66, PLATE_Y, -0.14], 'y', 0x1479c9, 4);

  // 5) Drag cell - S-type, horizontal, inline with the airflow (X). One rod-end
  //    pins to the moving plate, the other to the frame's drag post.
  const dragCell = withRealModel('tas501', createSBeamLoadCell(mats));
  addPart(dragCell, [1.0, PLATE_Y, -0.28], [0.8, 0.2, 0.0], 5);
  const dragLink = new THREE.Group();
  addCylinder(dragLink, [0.018, 0.018, 0.16], [0.7, PLATE_Y, -0.28], mats.darkMetal, 'x'); // plate side rod
  addCylinder(dragLink, [0.018, 0.018, 0.16], [1.32, PLATE_Y, -0.28], mats.darkMetal, 'x'); // frame side rod
  addRodEnd(dragLink, [0.64, PLATE_Y, -0.28]);
  addRodEnd(dragLink, [1.4, PLATE_Y, -0.28]);
  addBolt(dragLink, [0.64, PLATE_Y, -0.28], 'z', 0.13); // shoulder bolts through the rod-ends
  addBolt(dragLink, [1.4, PLATE_Y, -0.28], 'z', 0.13);
  addPart(dragLink, [0, 0, 0], [0.8, 0.2, 0.0], 5);
  addPulse([0.64, PLATE_Y, -0.28], 'x', 0xda3f48, 5);
  addPulse([1.4, PLATE_Y, -0.28], 'x', 0xda3f48, 5);

  // 6) Sting - clamps to the plate centre and rises UP through the floor slot.
  const sting = createSting(mats);
  addPart(sting, [-0.08, STING_Y, 0], [0, 1.1, 0], 6);
  addPulse([-0.08, PLATE_Y + 0.05, 0], 'y', 0x334657, 6);

  // 7) Aircraft - lands on the sting saddle, up in the airflow above the floor.
  //    Scaled so its 3 m span does not dwarf the balance + wiring below.
  const aircraft = withRealModel('fox', createFoxGlider(mats));
  aircraft.scale.setScalar(0.45);
  addPart(aircraft, [-0.08, AIR_Y, 0], [0, 1.0, 0.2], 7);
  addPulse([-0.08, AIR_Y - 0.12, 0], 'y', 0xe78a32, 7);

  // 8) DAQ (3x HX711 + Arduino) - on the bench beside the balance, below the
  //    floor; kept close so the wiring is clearly readable.
  const daq = createDaqAndLaptop(mats);
  addPart(daq, [1.62, -0.5, -0.2], [0.6, 0.25, -0.4], 8);

  // 8) Real 4-wire bridge cables: each cell -> its own HX711.
  const boards = { front: [1.62, -0.45, -0.44], rear: [1.62, -0.45, -0.2], drag: [1.62, -0.45, 0.04] };
  const cellOut = { front: [-0.45, -0.52, 0.14], rear: [0.45, -0.52, -0.14], drag: [1.0, -0.36, -0.28] };
  const bridge = [mats.wRed, mats.wBlack, mats.wGreen, mats.wWhite];
  Object.keys(cellOut).forEach((key) => {
    const s = cellOut[key];
    const b = boards[key];
    bridge.forEach((material, j) => {
      const o = (j - 1.5) * 0.02; // small spread so the 4 wires read separately
      addWire(
        [
          [s[0], s[1], s[2] + o * 0.3],
          [s[0] + (b[0] - s[0]) * 0.3, s[1] - 0.06, s[2] + (b[2] - s[2]) * 0.3 + o],
          [s[0] + (b[0] - s[0]) * 0.72, b[1] - 0.02 + o * 0.4, s[2] + (b[2] - s[2]) * 0.72 + o],
          [b[0] - 0.05, b[1] + 0.01, b[2] + o],
        ],
        material,
        0.0075,
        8
      );
    });
  });
  addPulse([1.62, -0.43, -0.2], 'z', 0x334657, 8);

  // 9) HX711 -> Arduino: DT (green) + SCK (copper) per board, plus a shared 5 V
  //    rail (red) and common GND rail (black) tying the three boards together.
  const uno = [2.2, -0.54, -0.16];
  Object.keys(boards).forEach((key, i) => {
    const b = boards[key];
    const lane = (i - 1) * 0.04;
    addWire(
      [
        [b[0] + 0.05, b[1], b[2] - 0.03],
        [b[0] + 0.3, b[1] - 0.03, b[2]],
        [uno[0] - 0.06, uno[1] + 0.03, uno[2] + lane],
        [uno[0], uno[1], uno[2] + lane],
      ],
      mats.wGreen,
      0.006,
      9
    );
    addWire(
      [
        [b[0] + 0.05, b[1], b[2] + 0.03],
        [b[0] + 0.3, b[1] - 0.05, b[2] + 0.02],
        [uno[0] - 0.06, uno[1] - 0.01, uno[2] + lane + 0.02],
        [uno[0], uno[1] - 0.02, uno[2] + lane + 0.02],
      ],
      mats.copper,
      0.006,
      9
    );
  });
  // Shared 5 V (red) + common GND (black) rails linking the three boards.
  addWire(
    [
      [boards.front[0] - 0.02, boards.front[1] + 0.05, boards.front[2]],
      [boards.rear[0] - 0.02, boards.rear[1] + 0.05, boards.rear[2]],
      [boards.drag[0] - 0.02, boards.drag[1] + 0.05, boards.drag[2]],
    ],
    mats.wRed,
    0.006,
    9
  );
  addWire(
    [
      [boards.front[0] - 0.05, boards.front[1] + 0.02, boards.front[2]],
      [boards.rear[0] - 0.05, boards.rear[1] + 0.02, boards.rear[2]],
      [boards.drag[0] - 0.05, boards.drag[1] + 0.02, boards.drag[2]],
    ],
    mats.wBlack,
    0.006,
    9
  );
  addPulse([uno[0], uno[1], uno[2]], 'y', 0x0b7890, 9);

  // Step labels that pop in with their part.
  addStepLabel('frame bolted to baseplate', [-0.86, FRAME_Y + 0.2, 0.46], '#2a9d5a', 1);
  addStepLabel('fixed end -> pedestal (M5)', [0.2, CELL_Y + 0.2, 0.16], '#9b242d', 2);
  addStepLabel('load arrow sets fixed/free end', [-0.34, CELL_Y + 0.26, 0.16], '#2a9d5a', 2);
  addStepLabel('free ends -> plate via drag-axis slide', [-0.74, PLATE_Y + 0.16, 0.16], '#1479c9', 4);
  addStepLabel('drag: rod-ends, frame<->plate', [1.0, PLATE_Y + 0.2, -0.28], '#9b242d', 5);
  addStepLabel('sting up through the floor slot', [-0.12, FLOOR_Y + 0.16, 0.22], '#334657', 6);
  addStepLabel('only the model + sting in the air', [-0.12, AIR_Y + 0.18, 0.26], '#17799d', 7);
  addStepLabel('red E+  black E-  green A+  white A-', [0.55, -0.66, -0.12], '#0b7890', 8);
  addStepLabel('DT/SCK -> D2-D7  ·  5V/GND', [2.16, -0.32, -0.16], '#0b7890', 9);

  return { animated, cables, labels, pulses };
}

// ===========================================================================
// Interactive Build Guide. The accurate, followable tutorial (researched +
// adversarially fact-checked by the build-tutorial workflow, grounded in the
// project's own "Expanded Build Version" notes). Content lives in
// src/buildGuide.json; this component just presents it in four tabs:
// Build Steps (the core walkthrough), Parts & Tools, Wiring & Code, and
// Calibrate & Pitfalls.
// ===========================================================================
function BuildGuideSlide() {
  const [tab, setTab] = useState('steps');
  const [step, setStep] = useState(0);
  const [showCode, setShowCode] = useState(false);
  const tabs = [
    ['steps', 'Build Steps'],
    ['parts', 'Parts & Tools'],
    ['wiring', 'Wiring & Code'],
    ['calib', 'Calibrate & Pitfalls'],
  ];
  return (
    <SlideShell title="Build It Yourself, Step by Step" kicker="Followable build guide" className="guide-shell">
      <div className="guide-layout">
        <nav className="guide-tabs">
          {tabs.map(([id, label]) => (
            <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </nav>
        <div className="guide-panel">
          {tab === 'steps' && <GuideSteps step={step} setStep={setStep} />}
          {tab === 'parts' && <GuideParts />}
          {tab === 'wiring' && <GuideWiring showCode={showCode} setShowCode={setShowCode} />}
          {tab === 'calib' && <GuideCalib />}
        </div>
      </div>
    </SlideShell>
  );
}

function GuideSteps({ step, setStep }) {
  const steps = buildGuide.steps;
  const s = steps[step];
  return (
    <div className="guide-steps">
      <div className="guide-step-rail">
        {steps.map((st, i) => (
          <button key={st.n} className={`grail ${i === step ? 'active' : ''}`} onClick={() => setStep(i)}>
            <span>{st.n}</span>
            <em>{st.phase}</em>
          </button>
        ))}
      </div>
      <article className="guide-step-card">
        <header>
          <div className="gstep-meta">
            <span className="gphase">{s.phase}</span>
            <span className="gcount">Step {s.n} of {steps.length}</span>
          </div>
          <h2>{s.title}</h2>
          <p className="ggoal">{s.goal}</p>
        </header>
        <div className="gchips">
          {s.parts.map((p, i) => (
            <span key={`p${i}`} className="gchip part">{p}</span>
          ))}
          {s.fasteners.map((f, i) => (
            <span key={`f${i}`} className="gchip fast">
              <Wrench size={11} /> {f}
            </span>
          ))}
        </div>
        <ol className="gactions">
          {s.actions.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ol>
        <div className="gcheck">
          <CheckCircle2 size={16} />
          <span><strong>Done right?</strong> {s.check}</span>
        </div>
        <div className="ggotcha">
          <AlertTriangle size={16} />
          <span><strong>Gotcha:</strong> {s.gotcha}</span>
        </div>
        <div className="gnav">
          <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
            <ArrowLeft size={16} /> Prev
          </button>
          <button onClick={() => setStep(Math.min(steps.length - 1, step + 1))} disabled={step === steps.length - 1}>
            Next <ArrowRight size={16} />
          </button>
        </div>
      </article>
    </div>
  );
}

function GuideParts() {
  return (
    <div className="guide-parts">
      <p className="goverview">{buildGuide.overview}</p>
      <h3>Bill of materials</h3>
      <div className="gbom">
        {buildGuide.bom.map((b, i) => (
          <article key={i} className="gbom-item">
            <div className="gbom-head">
              <strong>{b.part}</strong>
              <span className="gqty">x{b.qty}</span>
              <span className="gcost">{b.cost}</span>
            </div>
            <div className="gbom-spec">{b.spec}</div>
            <div className="gbom-src">Source: {b.source}</div>
            {b.note && <div className="gbom-note">{b.note}</div>}
          </article>
        ))}
      </div>
      <h3>Tools on the bench</h3>
      <ul className="gtools">
        {buildGuide.tools.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

function GuideWiring({ showCode, setShowCode }) {
  const w = buildGuide.wiring;
  return (
    <div className="guide-wiring">
      <div className="gw-toggle">
        <button className={!showCode ? 'active' : ''} onClick={() => setShowCode(false)}>
          <Cable size={15} /> Wiring map
        </button>
        <button className={showCode ? 'active' : ''} onClick={() => setShowCode(true)}>
          Arduino sketch
        </button>
      </div>
      {!showCode ? (
        <div className="gw-tables">
          <div className="gw-block">
            <h3>Each cell &rarr; its own HX711</h3>
            <ul>
              {w.cellToHx711.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </div>
          <div className="gw-block">
            <h3>HX711 &rarr; Arduino Uno</h3>
            <ul>
              {w.hx711ToArduino.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </div>
          <div className="gw-block notes">
            <h3>Wiring notes</h3>
            <ul>
              {w.notes.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <pre className="gcode">
          <code>{buildGuide.code}</code>
        </pre>
      )}
    </div>
  );
}

function GuideCalib() {
  return (
    <div className="guide-calib">
      <div className="gcal-steps">
        <h3>Calibrate the assembled rig</h3>
        {buildGuide.calibration.map((c) => (
          <article key={c.n} className="gcal-item">
            <strong>{c.n}. {c.title}</strong>
            <ol>
              {c.actions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ol>
          </article>
        ))}
      </div>
      <div className="gpitfalls">
        <h3>
          <AlertTriangle size={15} /> Mistakes that ruin the data
        </h3>
        <ul>
          {buildGuide.pitfalls.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function WiringSlide() {
  return (
    <SlideShell title="Wire Each Cell Into an HX711" kicker="Physical wiring">
      <div className="wiring-layout">
        <div className="daq-board">
          <img src={sparkfunHx711Img} alt="SparkFun HX711 load cell amplifier" />
          <h2>One HX711 per cell</h2>
          <p>The HX711 makes its own bridge excitation, so the cell's four wires land on the HX711 - not the Arduino.</p>
        </div>
        <div className="wire-map">
          <h3>Load cell &rarr; HX711 terminals</h3>
          {cellWires.map(([color, label, term, desc]) => (
            <div className="wire-map-row" key={term}>
              <span className={`wire-dot ${color}`} />
              <strong>{label}</strong>
              <ArrowRight size={15} />
              <span className="term">{term}</span>
              <span className="wire-desc">{desc}</span>
            </div>
          ))}
        </div>
        <div className="wire-map">
          <h3>HX711 &rarr; Arduino</h3>
          {hx711Pins.map(([pin, target, desc]) => (
            <div className="wire-map-row pin" key={pin}>
              <span className="term">{pin}</span>
              <ArrowRight size={15} />
              <strong>{target}</strong>
              <span className="wire-desc">{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </SlideShell>
  );
}

function PinMapSlide() {
  return (
    <SlideShell title="Three Channels Into the Arduino" kicker="Pin map and data log">
      <div className="pinmap-layout">
        <div className="pin-table-card">
          <table className="pin-table">
            <thead>
              <tr>
                <th>Reads</th>
                <th>Load cell</th>
                <th>HX711</th>
                <th>DT pin</th>
                <th>SCK pin</th>
              </tr>
            </thead>
            <tbody>
              {channelMap.map(([reads, cell, board, dt, sck]) => (
                <tr key={reads}>
                  <th>{reads}</th>
                  <td>{cell}</td>
                  <td>{board}</td>
                  <td><span className="pin-chip">{dt}</span></td>
                  <td><span className="pin-chip">{sck}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="pin-foot">
            All three boards share <strong>5 V</strong> and one common <strong>GND</strong>. Pins are an Arduino Uno example - any free digital pins work.
          </p>
          <pre className="code-card"><code>{`#include "HX711.h"
HX711 liftA, liftB, drag;   // one per channel
void setup() {
  liftA.begin(2, 3);   // begin(DT, SCK)
  liftB.begin(4, 5);
  drag.begin(6, 7);
}`}</code></pre>
          <div className="data-card">
            <h2>Log every run</h2>
            <div className="log-chips">
              {loggedColumns.map((column) => (
                <span key={column}>{column}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="wiring-notes">
          {wiringNotes.map(([title, text]) => (
            <article key={title}>
              <strong>{title}</strong>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </div>
    </SlideShell>
  );
}

function CalibrationSlide() {
  return (
    <SlideShell title="Calibrate Before Wind-On Data" kicker="Make the numbers trustworthy">
      <div className="calibration-layout">
        <div className="calibration-steps">
          <StepCard n="01" title="Wind-off tare" text="Record zero at each angle so weight, preload, and bias are removed." />
          <StepCard n="02" title="Lift calibration" text="Apply known vertical masses to the full assembled balance." />
          <StepCard n="03" title="Drag calibration" text="Use string, pulley, and hanging mass aligned with the drag axis." />
          <StepCard n="04" title="Cross-axis check" text="Pure lift should barely move drag; pure drag should barely move lift." />
        </div>
        <div className="test-run-card">
          <h2>Wind-tunnel run</h2>
          <ol>
            <li>Set angle of attack.</li>
            <li>Record wind-off readings.</li>
            <li>Turn tunnel on and wait for steady speed.</li>
            <li>Average force data for 5-15 seconds.</li>
            <li>Subtract tare and calculate coefficients.</li>
          </ol>
        </div>
      </div>
    </SlideShell>
  );
}

function PlanSlide() {
  return (
    <SlideShell title="Build Plan, Time, and Cost" kicker="First working version">
      <div className="plan-layout">
        <div className="build-timeline">
          {buildSteps.map((step) => (
            <StepCard key={step[0]} n={step[0]} title={step[1]} text={step[2]} />
          ))}
        </div>
        <div className="cost-panel">
          <div className="timeline-callout">
            <Timer size={24} />
            <div>
              <h2>2-4 weeks</h2>
              <p>Ordering, frame build, wiring, calibration, first tunnel checkout.</p>
            </div>
          </div>
          <table className="cost-table">
            <tbody>
              {bomRows.map((row) => (
                <tr key={row[0]}>
                  <th>{row[0]}</th>
                  <td>{row[1]}</td>
                  <td>{row[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </SlideShell>
  );
}

// Final references page: the verified verdict + the real, categorised sources
// every fact in the deck traces back to (from the fact-check workflow).
function SourcesSlide() {
  const categories = [
    'Balance & aerodynamics',
    'Load cells & mounting',
    'Electronics & HX711',
    'Calibration',
    'Where to buy',
  ];
  return (
    <SlideShell title="Sources & References" kicker="Where this all comes from">
      <div className="sources-layout">
        <aside className="sources-verdict">
          <div className="sv-badge">
            <ShieldCheck size={15} /> Fact-checked vs. the sources
          </div>
          <p>{sourcesData.summaryShort || sourcesData.summary}</p>
          <ul className="sv-corrections">
            {sourcesData.corrections.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </aside>
        <div className="sources-grid">
          {categories.map((cat) => {
            const items = sourcesData.sources.filter((s) => s.category === cat);
            if (!items.length) return null;
            return (
              <section key={cat} className="src-group">
                <h3>{cat}</h3>
                {items.map((s) => (
                  <a key={s.url} className="src-item" href={s.url} target="_blank" rel="noreferrer">
                    <strong>{s.title}</strong>
                    <span>{s.supports}</span>
                  </a>
                ))}
              </section>
            );
          })}
        </div>
      </div>
    </SlideShell>
  );
}

function BuildSetupSlide() {
  return (
    <SlideShell title="How to Build and Mount It" kicker="Assembly, bottom-up">
      <div className="build-layout">
        <div className="assembly-steps">
          {assemblySteps.map((step) => (
            <StepCard key={step[0]} n={step[0]} title={step[1]} text={step[2]} />
          ))}
        </div>
        <div className="placement-panel">
          <h2>Where it physically goes</h2>
          {placementRules.map(([title, text]) => (
            <article key={title}>
              <strong>{title}</strong>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </div>
    </SlideShell>
  );
}

function MakeBuySlide() {
  return (
    <SlideShell title="Make It or Buy It" kicker="Shopping list">
      <div className="sourcing-layout">
        <table className="source-table">
          <thead>
            <tr>
              <th>Part</th>
              <th>Make / Buy</th>
              <th>Where to get it</th>
            </tr>
          </thead>
          <tbody>
            {partSourcing.map(([part, mode, where]) => (
              <tr key={part}>
                <th>{part}</th>
                <td>
                  <span className={`mb-badge ${mode.toLowerCase()}`}>{mode}</span>
                </td>
                <td>{where}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="sourcing-aside">
          <article className="clarify-card">
            <strong>Two different "plates" — don't mix them up</strong>
            <p>
              <b>Moving / balance plate:</b> structural; carries the model's load into the cells. You make this.
            </p>
            <p>
              <b>Calibration weights:</b> known masses you hang only while calibrating. You buy these.
            </p>
          </article>
          <article className="clarify-card alt">
            <strong>Where the money goes</strong>
            <p>Sensors + amps are cheap (~$140 total). Most of the budget is the frame, the machined plate, and the DAQ — roughly $450–$1,250 all-in.</p>
          </article>
        </div>
      </div>
    </SlideShell>
  );
}

function BridgeSlide() {
  return (
    <SlideShell title="The Bridge Is Inside the Cell" kicker="No breadboard, no resistors">
      <div className="bridge2-layout">
        <div className="bridge-flow">
          <figure className="flow-card">
            <div className="flow-img">
              <img src={sparkfunTal220Img} alt="TAL220 load cell" />
            </div>
            <strong>1 &middot; Load cell</strong>
            <p>4 strain gauges wired as a Wheatstone bridge are sealed inside. Its 4 wires <em>are</em> the bridge.</p>
          </figure>
          <div className="flow-link">
            <span>4 wires<br />E+ E- A+ A-</span>
            <ArrowRight size={24} />
          </div>
          <figure className="flow-card">
            <div className="flow-img">
              <img src={sparkfunHx711Img} alt="HX711 amplifier" />
            </div>
            <strong>2 &middot; HX711 amp</strong>
            <p>The 4 wires screw straight in here. This is the only board you build onto.</p>
          </figure>
          <div className="flow-link">
            <span>VCC GND<br />DT SCK</span>
            <ArrowRight size={24} />
          </div>
          <figure className="flow-card">
            <div className="flow-img mcu-box">ARDUINO</div>
            <strong>3 &middot; Arduino</strong>
            <p>Reads the digital counts over DT/SCK, then your code converts them to Newtons.</p>
          </figure>
        </div>
        <div className="bridge-bust">
          <div className="bust no">
            <XCircle size={26} />
            <div>
              <strong>No breadboard. No resistors.</strong>
              <span>There is no bridge to assemble — the gauges are already inside the silver/steel body.</span>
            </div>
          </div>
          <div className="bust yes">
            <CheckCircle2 size={26} />
            <div>
              <strong>Just 4 wires per cell &rarr; HX711.</strong>
              <span>red&rarr;E+, black&rarr;E-, green&rarr;A+, white&rarr;A-. Then VCC/GND/DT/SCK to the Arduino.</span>
            </div>
          </div>
        </div>
      </div>
    </SlideShell>
  );
}

function MountingSlide() {
  return (
    <SlideShell title="How It Mounts in the Tunnel" kicker="The real install">
      <div className="mounting-layout">
        <figure className="xsection">
          <svg viewBox="0 0 720 460" role="img" aria-label="Cross-section of the balance mounted under the wind tunnel">
            <rect x="0" y="410" width="720" height="50" fill="#eef4f8" />
            <g stroke="#aebac4" strokeWidth="2">
              {Array.from({ length: 19 }).map((_, i) => (
                <line key={i} x1={18 + i * 38} y1="460" x2={42 + i * 38} y2="410" />
              ))}
            </g>
            <line x1="0" y1="410" x2="720" y2="410" stroke="#42566a" strokeWidth="3" />

            <rect x="120" y="44" width="470" height="150" fill="#eaf6fb" stroke="#9bc8e2" strokeWidth="2" />
            <line x1="120" y1="44" x2="120" y2="194" stroke="#9bc8e2" strokeWidth="2" strokeDasharray="6 6" />
            <line x1="590" y1="44" x2="590" y2="194" stroke="#9bc8e2" strokeWidth="2" strokeDasharray="6 6" />
            <g>
              <line x1="142" y1="90" x2="250" y2="90" stroke="#1678bd" strokeWidth="4" />
              <path d="M252 90 l-15 -8 v16 z" fill="#1678bd" />
            </g>
            <text x="150" y="78" fontSize="13" fontWeight="800" fill="#1678bd">airflow</text>

            <line x1="60" y1="194" x2="336" y2="194" stroke="#42566a" strokeWidth="5" />
            <line x1="384" y1="194" x2="660" y2="194" stroke="#42566a" strokeWidth="5" />
            <text x="652" y="186" fontSize="12" fontWeight="800" fill="#5e7184" textAnchor="end">tunnel floor</text>
            <text x="318" y="214" fontSize="11" fontWeight="800" fill="#5e7184" textAnchor="middle">slot</text>

            <g>
              <rect x="300" y="108" width="120" height="16" rx="8" fill="#ffffff" stroke="#42566a" strokeWidth="2" />
              <polygon points="300,108 300,124 280,116" fill="#e78a32" />
              <polygon points="414,108 430,108 426,90" fill="#ffffff" stroke="#42566a" strokeWidth="1.5" />
            </g>
            <text x="436" y="100" fontSize="12.5" fontWeight="800" fill="#122235">model</text>

            <rect x="354" y="122" width="12" height="176" fill="#2b333b" />
            <text x="374" y="256" fontSize="12.5" fontWeight="800" fill="#122235">sting</text>

            <rect x="250" y="296" width="220" height="14" rx="3" fill="#9fd6ef" stroke="#5aa9cf" strokeWidth="1.5" />
            <text x="250" y="288" fontSize="12.5" fontWeight="800" fill="#1678bd">moving plate</text>

            {[300, 420].map((cx) => (
              <g key={cx} fill="#c9ccd1" stroke="#8a98a4" strokeWidth="1.5">
                <rect x={cx - 6} y="310" width="12" height="14" />
                <rect x={cx - 30} y="324" width="60" height="12" rx="3" />
                <rect x={cx + 18} y="336" width="14" height="16" />
              </g>
            ))}
            <text x="360" y="344" fontSize="12" fontWeight="800" fill="#1678bd" textAnchor="middle">2 lift cells</text>

            <rect x="476" y="318" width="48" height="16" rx="3" fill="#c9ccd1" stroke="#8a98a4" strokeWidth="1.5" />
            <text x="500" y="310" fontSize="11.5" fontWeight="800" fill="#c63d4a" textAnchor="middle">drag cell</text>

            <rect x="232" y="350" width="300" height="16" rx="3" fill="#42566a" />
            <text x="232" y="392" fontSize="12.5" fontWeight="800" fill="#122235">rigid base — bolted down</text>
            <line x1="252" y1="366" x2="252" y2="410" stroke="#42566a" strokeWidth="6" />
            <line x1="512" y1="366" x2="512" y2="410" stroke="#42566a" strokeWidth="6" />
            <g fill="#122235">
              <circle cx="252" cy="396" r="4" />
              <circle cx="512" cy="396" r="4" />
            </g>

            <rect x="556" y="316" width="120" height="40" rx="6" fill="#d71920" />
            <text x="616" y="341" fontSize="12.5" fontWeight="800" fill="#ffffff" textAnchor="middle">3x HX711</text>
            <text x="616" y="376" fontSize="11.5" fontWeight="800" fill="#122235" textAnchor="middle">to Arduino</text>
          </svg>
          <figcaption>Only the model and the thin sting sit in the airflow. Everything that measures is below the floor, bolted to a rigid stand.</figcaption>
        </figure>

        <div className="mount-aside">
          <article className="mount-detail">
            <h2>How a cell bolts in</h2>
            <svg viewBox="0 0 300 130" role="img" aria-label="Bar cell mounting detail">
              <rect x="36" y="14" width="228" height="12" rx="2" fill="#9fd6ef" stroke="#5aa9cf" />
              <text x="150" y="11" fontSize="10" fontWeight="800" fill="#1678bd" textAnchor="middle">moving plate</text>
              <rect x="70" y="26" width="18" height="18" fill="#cfd8de" stroke="#8a98a4" />
              <rect x="70" y="44" width="160" height="16" rx="3" fill="#c9ccd1" stroke="#8a98a4" />
              <rect x="212" y="60" width="18" height="18" fill="#cfd8de" stroke="#8a98a4" />
              <rect x="36" y="78" width="228" height="12" rx="2" fill="#42566a" />
              <text x="150" y="104" fontSize="10" fontWeight="800" fill="#122235" textAnchor="middle">rigid base</text>
              <g fill="#122235">
                <circle cx="79" cy="35" r="3" />
                <circle cx="221" cy="69" r="3" />
              </g>
              <text x="30" y="40" fontSize="10" fontWeight="900" fill="#2a9d5a" textAnchor="end">UP</text>
              <text x="294" y="74" fontSize="10" fontWeight="900" fill="#2a9d5a" textAnchor="end">DOWN</text>
              <text x="150" y="73" fontSize="9.5" fontWeight="800" fill="#c63d4a" textAnchor="middle">flex gap</text>
            </svg>
            <p>Free end screws <b>up</b> to the plate, fixed end screws <b>down</b> to the base, with spacers so the middle can flex. Bolt both ends flat and it reads nothing.</p>
          </article>
          <article className="mount-rule">
            <strong>Standing it up</strong>
            <p>Build and calibrate on a bench, then bolt the base to the tunnel structure (or a heavy stand) under the floor and level it. Seal the slot loosely — but never let the seal touch the sting.</p>
          </article>
        </div>
      </div>
    </SlideShell>
  );
}

function ConnectionMapSlide() {
  const bolted = [
    ['Aircraft', 'Sting top saddle', '2 bolts / clamp'],
    ['Sting (bottom)', 'Moving plate center', 'Clamp block + bolts'],
    ['Moving plate', 'Lift cell FREE ends (x2)', 'M4 bolts + spacer'],
    ['Lift cell FIXED ends', 'Rigid base', 'M5 bolts + spacer'],
    ['Drag cell (both ends)', 'Frame + plate brackets', 'Rod-ends + shoulder bolts'],
    ['Rigid base', 'Tunnel stand / floor', 'Bolted down - must not move'],
  ];
  const wired = [
    ['Each cell (4 wires)', 'Its own HX711', 'red E+, blk E-, grn A+, wht A-'],
    ['HX711 #1 (lift A)', 'Arduino', 'DT D2 . SCK D3'],
    ['HX711 #2 (lift B)', 'Arduino', 'DT D4 . SCK D5'],
    ['HX711 #3 (drag)', 'Arduino', 'DT D6 . SCK D7'],
    ['All three HX711', 'Arduino', 'shared 5 V + common GND'],
  ];
  return (
    <SlideShell title="Every Connection, Spelled Out" kicker="What screws or wires to what">
      <div className="conn-layout">
        <div className="conn-card">
          <h2><Wrench size={18} /> Bolted together</h2>
          <table className="conn-table">
            <thead>
              <tr>
                <th>This part</th>
                <th>Attaches to</th>
                <th>With</th>
              </tr>
            </thead>
            <tbody>
              {bolted.map((row) => (
                <tr key={row[0]}>
                  <th>{row[0]}</th>
                  <td>{row[1]}</td>
                  <td>{row[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="conn-note">Only the cells, sting, and drag link may touch the moving plate — nothing else.</p>
        </div>
        <div className="conn-card">
          <h2><Cable size={18} /> Wired together</h2>
          <table className="conn-table">
            <thead>
              <tr>
                <th>From</th>
                <th>To</th>
                <th>Pins / wires</th>
              </tr>
            </thead>
            <tbody>
              {wired.map((row) => (
                <tr key={row[0]}>
                  <th>{row[0]}</th>
                  <td>{row[1]}</td>
                  <td>{row[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="conn-note">The bridge is inside each cell — no breadboard. 4 wires in, 4 pins out.</p>
        </div>
      </div>
    </SlideShell>
  );
}

function MetricStrip({ items }) {
  return (
    <div className="metric-strip">
      {items.map(([value, label]) => (
        <div key={label}>
          <strong>{value}</strong>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}

function ForceCard({ force }) {
  return (
    <article className={`force-card ${force.tone}`}>
      <strong>{force.name}</strong>
      <span>{force.value}</span>
      <p>{force.text}</p>
    </article>
  );
}

function AxisCard({ title, text, tone }) {
  return (
    <article className={`axis-card ${tone}`}>
      <h2>{title}</h2>
      <p>{text}</p>
    </article>
  );
}

function SensorRow({ cell }) {
  return (
    <article className={`sensor-row ${cell.kind}`}>
      <div className="sensor-image">
        <img src={cell.image} alt={cell.title} />
      </div>
      <div className="sensor-name">
        <h2>{cell.title}</h2>
        <span>{cell.tag}</span>
        <small>{cell.spec}</small>
      </div>
      <div className="sensor-copy">
        <strong>How it works</strong>
        <p>{cell.works}</p>
      </div>
      <div className="sensor-copy">
        <strong>What it does here</strong>
        <p>{cell.use}</p>
      </div>
    </article>
  );
}

function ForcePath() {
  const path = ['Airflow', 'Fox glider', 'Sting', 'Moving plate', 'Load cells', 'Data'];
  return (
    <div className="force-path">
      {path.map((item, index) => (
        <React.Fragment key={item}>
          <span>{item}</span>
          {index < path.length - 1 && <ArrowRight size={16} />}
        </React.Fragment>
      ))}
    </div>
  );
}

function SetupRule({ icon: Icon, title, text, tone }) {
  return (
    <article className={`setup-rule ${tone}`}>
      <Icon size={24} />
      <div>
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
    </article>
  );
}

function StepCard({ n, title, text }) {
  return (
    <article className="step-card">
      <strong>{n}</strong>
      <div>
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
    </article>
  );
}

function RigCanvas({ sceneMode }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf7fbff);

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(3.55, 2.05, 3.05);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    // Soft image-based lighting so the machined metal and PCBs pick up real
    // reflections and read crisp/pristine rather than flat.
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;
    scene.environmentIntensity = 0.5;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    scene.add(new THREE.HemisphereLight(0xffffff, 0xb8cad8, 1.6));

    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(4.5, 5, 3);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    scene.add(key);

    const rim = new THREE.DirectionalLight(0x9bdcff, 1.0);
    rim.position.set(-4, 1.8, -3);
    scene.add(rim);

    const root = new THREE.Group();
    root.position.set(0, -0.08, 0);
    scene.add(root);
    buildScene(root, sceneMode);

    // Auto-frame the whole rig so the model is always fully visible and never
    // hides behind the caption card in the top-left corner.
    frameSceneToCamera(camera, controls, root);

    const resize = () => {
      const width = mount.clientWidth || 800;
      const height = mount.clientHeight || 600;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      envTexture.dispose();
      pmrem.dispose();
      renderer.dispose();
      scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) object.material.forEach((mat) => mat.dispose());
          else object.material.dispose();
        }
      });
      mount.removeChild(renderer.domElement);
    };
  }, [sceneMode]);

  return <div className="canvas-host" ref={mountRef} />;
}

// Measure the assembled scene and position the camera so the entire rig fits in
// frame on a 16:9 slide, then slide the framing slightly right so the top-left
// caption card never covers the model.
function frameSceneToCamera(camera, controls, root) {
  // Build a bounding box from only the real rig parts. We skip the floor,
  // tunnel shell, labels, wires, and arrows (flagged or non-mesh) so they don't
  // inflate the box and shrink the model.
  root.updateWorldMatrix(true, true);
  const box = new THREE.Box3();
  const tmp = new THREE.Box3();
  root.traverse((obj) => {
    if (!obj.isMesh || !obj.geometry) return;
    let node = obj;
    while (node) {
      if (node.userData && node.userData.fitIgnore) return;
      node = node.parent;
    }
    tmp.setFromObject(obj);
    box.union(tmp);
  });
  if (box.isEmpty()) box.setFromObject(root);

  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const center = sphere.center;
  const radius = sphere.radius;

  const vFov = (camera.fov * Math.PI) / 180;
  // On a 16:9 canvas the vertical field of view is the tighter constraint, so
  // fit to it; that leaves spare horizontal room to offset the model sideways.
  const fitDist = (radius / Math.sin(vFov / 2)) * 1.08;

  const dir = new THREE.Vector3(1, 0.58, 0.95).normalize();
  camera.position.copy(center).addScaledVector(dir, fitDist);
  controls.target.copy(center);

  // Pan the view (camera + target together) so the model shifts right and down,
  // clear of the title caption that floats in the upper-left corner.
  const screenRight = new THREE.Vector3().crossVectors(dir, camera.up).normalize();
  const screenUp = new THREE.Vector3().crossVectors(screenRight, dir).normalize();
  const pan = new THREE.Vector3()
    .addScaledVector(screenRight, -radius * 0.32)
    .addScaledVector(screenUp, radius * 0.16);
  camera.position.add(pan);
  controls.target.add(pan);

  camera.near = Math.max(fitDist - radius * 2, 0.05);
  camera.far = fitDist + radius * 4;
  camera.updateProjectionMatrix();

  controls.minDistance = fitDist * 0.5;
  controls.maxDistance = fitDist * 2.5;
  controls.update();
}

// Real-model drop-in pipeline. Put an exact product mesh at public/models/<file>
// and flip `enabled: true` for that part - it then replaces the hand-built one,
// auto-scaled to `fit` units (longest axis) and recentred. Missing/disabled =>
// the procedural part is kept, so the deck never breaks. `rot`/`lift` let a real
// mesh be re-oriented to match the scene without editing geometry.
const PART_MODELS = {
  hx711: { url: '/models/hx711.glb', enabled: true, fit: 0.34, rot: [0, 0, 0] },
  tal220: { url: '/models/tal220.glb', enabled: true, fit: 0.8, rot: [0, 0, Math.PI / 2] },
  tas501: { url: '/models/tas501.glb', enabled: true, fit: 0.76, rot: [0, 0, 0] },
  fox: { url: '/models/fox.glb', enabled: false, fit: 3.0, rot: [0, 0, 0] },
};

const gltfLoader = new GLTFLoader();
const modelCache = new Map();

// Wrap a procedural part group: if a real model is enabled, load it async and
// swap it in (normalized to size + recentred); otherwise keep the procedural.
function withRealModel(name, group) {
  const cfg = PART_MODELS[name];
  if (!cfg || !cfg.enabled) return group;
  const apply = (gltf) => {
    const model = gltf.scene.clone(true);
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const scale = cfg.fit / Math.max(size.x, size.y, size.z || 1);
    model.scale.setScalar(scale);
    model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
    model.rotation.set(cfg.rot[0], cfg.rot[1], cfg.rot[2]);
    model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    group.clear();
    group.add(model);
  };
  if (modelCache.has(name)) {
    apply(modelCache.get(name));
  } else {
    gltfLoader.load(
      cfg.url,
      (gltf) => {
        modelCache.set(name, gltf);
        apply(gltf);
      },
      undefined,
      () => {} // missing file -> keep the procedural fallback silently
    );
  }
  return group;
}

function buildScene(root, sceneMode) {
  const mats = makeMaterials(sceneMode);
  if (sceneMode === 'workbench') {
    addWorkbenchScene(root, mats);
    return;
  }

  if (sceneMode === 'aircraft') {
    addAircraftReference(root, mats);
    return;
  }

  const exploded = sceneMode === 'exploded';
  const assembly = sceneMode === 'assembly';
  const forceView = sceneMode === 'forces';
  const wiringView = sceneMode === 'wiring' || sceneMode === 'assembly';

  addTunnel(root, mats);
  addFrame(root, mats, exploded);

  const aircraft = withRealModel('fox', createFoxGlider(mats));
  aircraft.position.set(exploded ? -0.82 : -0.08, exploded ? 1.42 : 0.98, exploded ? -0.12 : 0);
  root.add(aircraft);

  const sting = createSting(mats);
  sting.position.set(exploded ? -0.88 : -0.08, exploded ? 0.62 : 0.36, exploded ? -0.85 : 0);
  root.add(sting);

  const plate = createMovingPlate(mats);
  plate.position.set(exploded ? -0.08 : 0, exploded ? 0.1 : -0.1, exploded ? -0.95 : 0);
  root.add(plate);

  // Bar cells are cantilevers: lay them horizontal (long axis along X) so the
  // vertical lift load bends them, fixed end out / free end toward the plate.
  const frontCell = withRealModel('tal220', createBeamLoadCell(mats, 'front'));
  frontCell.rotation.z = -Math.PI / 2;
  frontCell.position.set(exploded ? -0.72 : -0.46, exploded ? -0.38 : -0.45, exploded ? 0.78 : 0.18);
  root.add(frontCell);

  const rearCell = withRealModel('tal220', createBeamLoadCell(mats, 'rear'));
  rearCell.rotation.z = -Math.PI / 2;
  rearCell.position.set(exploded ? 0.72 : 0.46, exploded ? -0.38 : -0.45, exploded ? 0.78 : 0.18);
  root.add(rearCell);

  const dragCell = withRealModel('tas501', createSBeamLoadCell(mats));
  dragCell.position.set(exploded ? 1.45 : 1.18, exploded ? -0.05 : -0.16, exploded ? 0.45 : -0.5);
  root.add(dragCell);

  if (!exploded) addDragLinkage(root, mats);

  const daq = createDaqAndLaptop(mats);
  daq.position.set(exploded ? 1.72 : 1.78, exploded ? -0.35 : -0.5, exploded ? -1.1 : -1.05);
  root.add(daq);

  if (sceneMode === 'cell') addLoadCellDemo(root, mats);
  if (forceView) addForceArrows(root, mats);
  if (wiringView || exploded) addWiring(root, mats, exploded);
  if (assembly) addAssemblyGuides(root, mats);

  addLabels(root, sceneMode);
}

function addWorkbenchScene(root, mats) {
  const table = new THREE.Mesh(
    new THREE.BoxGeometry(3.9, 0.08, 2.45),
    new THREE.MeshStandardMaterial({ color: 0xf2f8fc, roughness: 0.72, metalness: 0.04 })
  );
  table.position.set(0.05, -0.58, 0);
  table.receiveShadow = true;
  table.userData.fitIgnore = true;
  root.add(table);

  const plate = createMovingPlate(mats);
  plate.position.set(0.62, -0.43, -0.58);
  root.add(plate);

  const sting = createSting(mats);
  sting.rotation.z = Math.PI / 2;
  sting.position.set(1.18, -0.38, 0.36);
  root.add(sting);

  // Loose bar cells lying flat on the bench, parallel (long axis along X).
  const frontCell = withRealModel('tal220', createBeamLoadCell(mats, 'front'));
  frontCell.rotation.z = -Math.PI / 2;
  frontCell.position.set(-0.62, -0.47, 0.42);
  root.add(frontCell);

  const rearCell = withRealModel('tal220', createBeamLoadCell(mats, 'rear'));
  rearCell.rotation.z = -Math.PI / 2;
  rearCell.position.set(-0.62, -0.47, 0.78);
  root.add(rearCell);

  // S-type standing on the bench so its signature S-face reads to the camera.
  const dragCell = withRealModel('tas501', createSBeamLoadCell(mats));
  dragCell.position.set(-0.85, -0.29, -0.45);
  root.add(dragCell);

  const daq = createDaqAndLaptop(mats);
  daq.position.set(1.6, -0.52, -0.35);
  daq.scale.set(0.92, 0.92, 0.92);
  root.add(daq);

  addRail(root, 'x', 1.25, [0.42, -0.43, 0.88], mats);
  addRail(root, 'z', 0.95, [0.08, -0.43, 0.47], mats);
  addCylinder(root, [0.02, 0.02, 0.65], [-0.18, -0.37, -0.74], mats.darkMetal, 'x');
  addCylinder(root, [0.02, 0.02, 0.65], [0.15, -0.37, -0.74], mats.darkMetal, 'x');

  addLabel(root, '2x TAL220 (80 mm)', [-0.82, -0.12, 0.82], '#1479c9');
  addLabel(root, 'TAS501 (76 mm)', [-0.82, -0.06, -0.7], '#9b242d');
  addLabel(root, 'moving plate', [0.62, -0.04, -0.78], '#1479c9');
  addLabel(root, '3x HX711 (34 mm)', [1.2, -0.14, -0.86], '#334657');

  // To-scale reference: 1 scene unit = 100 mm, so this bar reads 100 mm.
  addScaleBar(root, 1.0, [0.2, -0.52, 1.08], '100 mm');
}

function addAircraftReference(root, mats) {
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 3.2), new THREE.MeshStandardMaterial({ color: 0xf1f8fc, roughness: 0.86 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.46;
  floor.receiveShadow = true;
  root.add(floor);

  const aircraft = createFoxGlider(mats);
  aircraft.scale.set(1.28, 1.28, 1.28);
  aircraft.position.set(-0.08, 0.28, 0);
  root.add(aircraft);

  addLine(root, [[-0.26, 0.1, -1.92], [-0.26, 0.1, 1.92]], mats.liftLine);
  addLine(root, [[-1.42, -0.03, -0.18], [1.12, -0.03, -0.18]], mats.dragLine);
  addForceArrow(root, [-0.26, 0.1, -1.9], [0, 0, 1], 0.28, 0x1479c9);
  addForceArrow(root, [-0.26, 0.1, 1.9], [0, 0, -1], 0.28, 0x1479c9);
  addForceArrow(root, [-1.4, -0.03, -0.18], [1, 0, 0], 0.25, 0xda3f48);
  addForceArrow(root, [1.1, -0.03, -0.18], [-1, 0, 0], 0.25, 0xda3f48);
  addLabel(root, 'wingspan 3000 mm', [-0.58, 0.32, 1.1], '#1479c9');
  addLabel(root, 'length 1873 mm', [-0.2, 0.22, -0.48], '#9b242d');
  addLabel(root, 'Fox-style 3D reference', [-0.64, 0.82, -0.88], '#334657');
}

function makeMaterials(sceneMode) {
  const ghost = sceneMode === 'cell' ? 0.42 : 1;
  return {
    aircraftWhite: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.42, metalness: 0.02, transparent: true, opacity: ghost }),
    aircraftOrange: new THREE.MeshStandardMaterial({ color: 0xf2852f, roughness: 0.45, transparent: true, opacity: ghost }),
    aircraftBlue: new THREE.MeshStandardMaterial({ color: 0x58b8ee, roughness: 0.45, transparent: true, opacity: ghost }),
    canopy: new THREE.MeshPhysicalMaterial({ color: 0x1d496b, roughness: 0.18, transmission: 0.08, transparent: true, opacity: 0.64 }),
    prop: new THREE.MeshStandardMaterial({ color: 0x182434, roughness: 0.42, metalness: 0.2, transparent: true, opacity: ghost }),
    aluminum: new THREE.MeshStandardMaterial({ color: 0xcad7df, roughness: 0.28, metalness: 0.6 }),
    darkMetal: new THREE.MeshStandardMaterial({ color: 0x334657, roughness: 0.34, metalness: 0.42 }),
    black: new THREE.MeshStandardMaterial({ color: 0x121820, roughness: 0.5 }),
    plate: new THREE.MeshStandardMaterial({ color: 0x96dfff, roughness: 0.25, metalness: 0.24, transparent: true, opacity: 0.83 }),
    sensorBody: new THREE.MeshStandardMaterial({ color: 0xd9e1e5, roughness: 0.22, metalness: 0.72 }),
    sensorFace: new THREE.MeshStandardMaterial({ color: 0xf8fbfd, roughness: 0.28, metalness: 0.24 }),
    flexHole: new THREE.MeshStandardMaterial({ color: 0x2c3a46, roughness: 0.62, metalness: 0.18 }),
    sensorLabel: new THREE.MeshStandardMaterial({ color: 0x35b56a, roughness: 0.38, metalness: 0.05 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x9aa7b2, roughness: 0.34, metalness: 0.85 }),
    silicone: new THREE.MeshStandardMaterial({ color: 0xe8e0cd, roughness: 0.55, metalness: 0.02 }),
    sticker: new THREE.MeshStandardMaterial({ color: 0xf4f6f2, roughness: 0.6, metalness: 0.0 }),
    chip: new THREE.MeshStandardMaterial({ color: 0x16191e, roughness: 0.45, metalness: 0.25 }),
    pcbGreen: new THREE.MeshStandardMaterial({ color: 0x1f7a4d, roughness: 0.5, metalness: 0.05 }),
    tin: new THREE.MeshStandardMaterial({ color: 0xc2c7cd, roughness: 0.3, metalness: 0.7 }),
    jacket: new THREE.MeshStandardMaterial({ color: 0x2b333b, roughness: 0.5, metalness: 0.1 }),
    wRed: new THREE.MeshStandardMaterial({ color: 0xd1323d, roughness: 0.45 }),
    wBlack: new THREE.MeshStandardMaterial({ color: 0x20262d, roughness: 0.45 }),
    wGreen: new THREE.MeshStandardMaterial({ color: 0x2a9d5a, roughness: 0.45 }),
    wWhite: new THREE.MeshStandardMaterial({ color: 0xe7ecef, roughness: 0.45 }),
    nickelSteel: new THREE.MeshStandardMaterial({ color: 0xc9ccd1, metalness: 0.85, roughness: 0.32 }),
    cableGrey: new THREE.MeshStandardMaterial({ color: 0xb8bcc0, metalness: 0.15, roughness: 0.7 }),
    tanCeramicCap: new THREE.MeshStandardMaterial({ color: 0xc2a678, roughness: 0.6, metalness: 0.05 }),
    hx711Board: new THREE.MeshStandardMaterial({ color: 0xd71920, roughness: 0.36, metalness: 0.08 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xd7a43a, roughness: 0.28, metalness: 0.65 }),
    lift: new THREE.MeshStandardMaterial({ color: 0x1479c9, roughness: 0.25, metalness: 0.35 }),
    liftRear: new THREE.MeshStandardMaterial({ color: 0x33aaf3, roughness: 0.25, metalness: 0.35 }),
    drag: new THREE.MeshStandardMaterial({ color: 0xda3f48, roughness: 0.3, metalness: 0.25 }),
    copper: new THREE.MeshStandardMaterial({ color: 0xd77a36, roughness: 0.25, metalness: 0.35 }),
    wire: new THREE.LineBasicMaterial({ color: 0x11aeca }),
    wireRed: new THREE.LineBasicMaterial({ color: 0xd9303f }),
    wireBlack: new THREE.LineBasicMaterial({ color: 0x17202b }),
    wireGreen: new THREE.LineBasicMaterial({ color: 0x249a5f }),
    wireWhite: new THREE.LineBasicMaterial({ color: 0xffffff }),
    liftLine: new THREE.LineBasicMaterial({ color: 0x1479c9 }),
    dragLine: new THREE.LineBasicMaterial({ color: 0xda3f48 }),
    pitchLine: new THREE.LineBasicMaterial({ color: 0x7651d1 }),
  };
}

// FMS Fox 3000 mm electric glider. Modeled nose-forward at -X, tail at +X,
// Y up. 1 unit = 100 mm, so the wing tips at z = +/-1.5 give the real 3000 mm
// span. Livery follows the real airframe: glossy WHITE with ORANGE + BLACK
// trim (the reference photo, not red/blue). Pod-and-boom fuselage, long bubble
// canopy, cruciform tail (horizontal stab high on a swept fin), pointed
// spinner + thin 2-blade folding prop, and FMS / FOX graphics.
function createFoxGlider(mats) {
  const group = new THREE.Group();

  // --- Fat cockpit pod blending into a long skinny tail boom ---------------
  group.add(createFuselage(mats.aircraftWhite));
  // Long slender tail boom carries the pod profile back to the tail surfaces,
  // making the classic sailplane pod-and-boom silhouette unmistakable.
  addCylinder(group, [0.018, 0.05, 1.18], [0.42, 0.01, 0], mats.aircraftWhite, 'x');

  // --- Extremely long, slender, high-aspect-ratio tapered wings ------------
  addWing(group, 1, mats);
  addWing(group, -1, mats);

  // --- Long clear bubble canopy faired into the spine over the mid-wing ----
  // A stretched, tinted dome; a small dark "pilot/cockpit" hint sits inside.
  addScaledSphere(group, [0.30, 0.082, 0.105], [-0.40, 0.142, 0], mats.canopy);
  addScaledSphere(group, [0.10, 0.045, 0.05], [-0.46, 0.12, 0], mats.black);
  // Canopy frame line where the glass meets the white fuselage spine.
  addBox(group, [0.62, 0.006, 0.012], [-0.40, 0.108, 0.092], mats.black);
  addBox(group, [0.62, 0.006, 0.012], [-0.40, 0.108, -0.092], mats.black);

  // --- Pointed nose: red/orange ring, spinner, thin 2-blade folding prop ---
  // Bold orange nose flash ring just aft of the spinner (geometry, not decal).
  addCylinder(group, [0.075, 0.085, 0.09], [-1.0, 0.0, 0], mats.aircraftOrange, 'x');
  // Pointed spinner cone: apex must face FORWARD (-X). A +PI/2 Z-rotation maps
  // the cone's default +Y apex to -X (the previous -PI/2 pointed it backward).
  addCone(group, [0.072, 0.16, 28], [-1.14, 0, 0], mats.aircraftOrange, Math.PI / 2);
  addFoxPropeller(group, mats);

  // --- Cruciform / high-mounted tail ---------------------------------------
  addFoxTail(group, mats);

  // --- Spanwise cheat stripes on the wing top (thin orange + black) --------
  // Hug the wing top surface (root top is y ~ 0.03, rising to the tip) rather
  // than floating above it.
  [1, -1].forEach((side) => {
    addBox(group, [0.10, 0.006, 1.20], [-0.12, 0.04, 0.62 * side], mats.aircraftOrange);
    addBox(group, [0.05, 0.006, 1.20], [-0.20, 0.04, 0.62 * side], mats.black);
    // High-visibility orange tip band, underside near each tip.
    addBox(group, [0.16, 0.012, 0.18], [-0.12, 0.05, 1.30 * side], mats.aircraftOrange);
  });

  // Small belly hatch (battery bay) under the pod, dark gray.
  addBox(group, [0.30, 0.018, 0.14], [-0.55, -0.12, 0], mats.darkMetal);

  addFoxDecals(group, mats);
  return group;
}

// Thin 2-blade folding scimitar prop on the spinner. A single long, slim blade
// (NOT a 4-blade plus-sign) sweeps through the hub; a hub cap finishes it.
function addFoxPropeller(group, mats) {
  // One slim blade spanning top-to-bottom through the hub.
  const blade = addBox(group, [0.012, 0.46, 0.05], [-1.205, 0, 0], mats.prop);
  // Slight scimitar rake so it reads as a folding glider prop, not a paddle.
  blade.rotation.x = 0.18;
  // Hub cap behind the spinner.
  addCylinder(group, [0.03, 0.03, 0.02], [-1.205, 0, 0], mats.darkMetal, 'x');
}

// Cruciform tail: a swept vertical fin with the horizontal stabilizer mounted
// HIGH, near the top of the fin (the Fox's signature tail). Built inline from
// thin tapered slabs so it does not depend on the conventional low-tail
// helpers elsewhere in the file.
function addFoxTail(group, mats) {
  // Swept vertical fin (leading edge raked back) standing on the boom end.
  const finVerts = [
    0.86, 0.02, -0.012,  1.12, 0.02, -0.012,  1.06, 0.46, -0.010,  0.98, 0.46, -0.010,
    0.86, 0.02, 0.012,   1.12, 0.02, 0.012,   1.06, 0.46, 0.010,   0.98, 0.46, 0.010,
  ];
  const finIdx = [
    0, 4, 5, 0, 5, 1, 1, 5, 6, 1, 6, 2, 2, 6, 7, 2, 7, 3,
    3, 7, 4, 3, 4, 0, 4, 7, 6, 4, 6, 5, 0, 1, 2, 0, 2, 3,
  ];
  const finGeo = new THREE.BufferGeometry();
  finGeo.setAttribute('position', new THREE.Float32BufferAttribute(finVerts, 3));
  finGeo.setIndex(finIdx);
  finGeo.computeVertexNormals();
  const fin = new THREE.Mesh(finGeo, mats.aircraftWhite);
  fin.castShadow = true;
  group.add(fin);

  // Horizontal stabilizer mounted HIGH on the fin (cruciform), tapered.
  [1, -1].forEach((side) => {
    const hVerts = [
      0.98, 0.43, 0.02 * side,  1.10, 0.43, 0.02 * side,
      1.00, 0.445, 0.42 * side, 1.07, 0.445, 0.42 * side,
      0.98, 0.418, 0.02 * side, 1.10, 0.418, 0.02 * side,
      1.00, 0.435, 0.42 * side, 1.07, 0.435, 0.42 * side,
    ];
    const hIdx = [0, 2, 1, 1, 2, 3, 4, 5, 6, 5, 7, 6, 0, 4, 2, 4, 6, 2, 1, 3, 5, 5, 3, 7, 2, 6, 3, 3, 6, 7];
    const hGeo = new THREE.BufferGeometry();
    hGeo.setAttribute('position', new THREE.Float32BufferAttribute(hVerts, 3));
    hGeo.setIndex(hIdx);
    hGeo.computeVertexNormals();
    const stab = new THREE.Mesh(hGeo, mats.aircraftWhite);
    stab.castShadow = true;
    group.add(stab);
  });
}

// FMS / FOX livery decals painted onto the airframe faces.
function addFoxDecals(group, mats) {
  // "FMS" on both sides of the forward pod, below the canopy.
  addDecal(group, 'FMS', [-0.30, 0.02, 0.123], [0, 0, 0], 0.22, '#1b1b1b', null);
  addDecal(group, 'FMS', [-0.30, 0.02, -0.123], [0, Math.PI, 0], 0.22, '#1b1b1b', null);
  // "FOX" on the nose sides, integrated with the orange trim.
  addDecal(group, 'FOX', [-0.66, 0.0, 0.118], [0, 0, 0], 0.20, '#f2852f', null);
  addDecal(group, 'FOX', [-0.66, 0.0, -0.118], [0, Math.PI, 0], 0.20, '#f2852f', null);
  // Stylized fox-head accent (orange triangle hint) just behind the nose ring.
  addDecal(group, '▲', [-0.86, 0.05, 0.1], [0, 0, 0], 0.07, '#f2852f', null);
  addDecal(group, '▲', [-0.86, 0.05, -0.1], [0, Math.PI, 0], 0.07, '#f2852f', null);
  // Vertical red/orange + blue trim stripe with a small logo on the fin.
  addDecal(group, '♠', [1.02, 0.30, 0.012], [0, 0, 0], 0.08, '#f2852f', null);
  addDecal(group, '♠', [1.02, 0.30, -0.012], [0, Math.PI, 0], 0.08, '#f2852f', null);
  // Thin spanwise cheat-stripe callouts on the wing top, near the root.
  addDecal(group, 'fox', [-0.14, 0.041, 0.45], [-Math.PI / 2, 0, 0], 0.14, '#1479c9', null);
  addDecal(group, 'fox', [-0.14, 0.041, -0.45], [-Math.PI / 2, 0, 0], 0.14, '#1479c9', null);
}

function createFuselage(material) {
  const stations = [
    [-1.02, 0.025, 0.026],
    [-0.85, 0.095, 0.08],
    [-0.55, 0.15, 0.118],
    [-0.18, 0.145, 0.122],
    [0.2, 0.118, 0.1],
    [0.56, 0.075, 0.065],
    [0.87, 0.038, 0.035],
  ];
  const radial = 30;
  const vertices = [];
  const indices = [];

  stations.forEach(([x, ry, rz]) => {
    for (let j = 0; j < radial; j += 1) {
      const a = (j / radial) * Math.PI * 2;
      const y = Math.cos(a) * ry;
      const z = Math.sin(a) * rz;
      vertices.push(x, y, z);
    }
  });

  for (let i = 0; i < stations.length - 1; i += 1) {
    for (let j = 0; j < radial; j += 1) {
      const a = i * radial + j;
      const b = i * radial + ((j + 1) % radial);
      const c = (i + 1) * radial + ((j + 1) % radial);
      const d = (i + 1) * radial + j;
      indices.push(a, b, d, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function addWing(group, side, mats) {
  const rootZ = 0.09 * side;
  const tipZ = 1.5 * side;
  const rootLE = -0.37;
  const rootTE = 0.16;
  const tipLE = -0.25;
  const tipTE = -0.03;
  const rootYTop = 0.028;
  const rootYBottom = -0.016;
  const tipYTop = 0.085;
  const tipYBottom = 0.055;

  const vertices = [
    rootLE, rootYTop, rootZ,
    rootTE, rootYTop, rootZ,
    rootLE, rootYBottom, rootZ,
    rootTE, rootYBottom, rootZ,
    tipLE, tipYTop, tipZ,
    tipTE, tipYTop, tipZ,
    tipLE, tipYBottom, tipZ,
    tipTE, tipYBottom, tipZ,
  ];
  const indices = [
    0, 4, 1, 1, 4, 5,
    2, 3, 6, 3, 7, 6,
    0, 2, 4, 2, 6, 4,
    1, 5, 3, 3, 5, 7,
    4, 6, 5, 5, 6, 7,
    0, 1, 2, 1, 3, 2,
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const wing = new THREE.Mesh(geometry, mats.aircraftWhite);
  wing.castShadow = true;
  wing.receiveShadow = true;
  group.add(wing);
}

function createSting(mats) {
  const group = new THREE.Group();
  // Slightly tapered vertical sting rod, plate clamp at the bottom up to the
  // fuselage saddle at the top.
  addCylinder(group, [0.022, 0.03, 0.9], [0, 0, 0], mats.darkMetal, 'y');
  // Thin streamlined fairing running up the rod (keeps the sting low-drag).
  addRoundedBox(group, [0.012, 0.84, 0.07], [0, 0, 0.014], mats.steel, 0.005);
  // Fuselage saddle (a cradle clamp) at the top.
  addCylinder(group, [0.055, 0.055, 0.2], [0, 0.46, 0], mats.aluminum, 'x');
  addBox(group, [0.16, 0.05, 0.15], [0, 0.41, 0], mats.darkMetal);
  // Clamp block that bolts onto the moving plate at the bottom.
  addBox(group, [0.2, 0.06, 0.2], [0, -0.46, 0], mats.aluminum);
  addBoltPattern(group, [0, -0.43, 0], mats);
  return group;
}

function createMovingPlate(mats) {
  const group = new THREE.Group();
  // Translucent skin so the hidden cells underneath stay visible.
  addBox(group, [1.38, 0.05, 0.78], [0, 0, 0], mats.plate);
  // Brushed-aluminum stiffener rails along the long edges.
  addBox(group, [1.4, 0.014, 0.07], [0, 0.028, 0.36], mats.aluminum);
  addBox(group, [1.4, 0.014, 0.07], [0, 0.028, -0.36], mats.aluminum);
  // Central boss where the sting clamp bolts down.
  addBox(group, [0.22, 0.07, 0.22], [0, 0.05, 0], mats.aluminum);
  addBoltPattern(group, [0, 0.06, 0], mats);
  // Mounting tabs underneath at the four lift-cell attachment points.
  [-0.46, 0.46].forEach((x) => {
    [-0.24, 0.24].forEach((z) => {
      addBox(group, [0.16, 0.05, 0.16], [x, -0.045, z], mats.aluminum);
      addBoltPattern(group, [x, -0.015, z], mats);
    });
  });
  return group;
}

function createBeamLoadCell(mats, which) {
  // SparkFun TAL220 10 kg single-point strain-gauge load cell.
  // Brushed-aluminum square bar, built with the long axis VERTICAL (+Y); the
  // scene lays it horizontal where a cantilever bar cell actually mounts.
  // 1 unit = 100 mm, so the bar is 0.80 u long x 0.127 u x 0.127 u.
  const group = new THREE.Group();
  // Matched pair in reality; we mark front vs rear only with the gauge-pad tint.
  const accent = which === 'front' ? mats.sensorFace : mats.darkMetal;
  const half = 0.0635; // half the 0.127 cross-section
  const thru = 0.135;  // through-feature length (slightly proud of the body)

  // 1) Main bar body + fine milled chamfer lines on the front edges.
  addRoundedBox(group, [0.127, 0.8, 0.127], [0, 0, 0], mats.aluminum, 0.012);
  addBox(group, [0.006, 0.74, 0.006], [0.0615, 0, 0.0615], mats.darkMetal);
  addBox(group, [0.006, 0.74, 0.006], [-0.0615, 0, 0.0615], mats.darkMetal);

  // 2) Figure-8 flexure: two stacked bores + a thin waist slot through the
  //    thickness (Z), with bright machined rims on both faces.
  const boreR = 0.043;
  [0.072, -0.072].forEach((y) => {
    addCylinder(group, [boreR, boreR, thru], [0, y, 0], mats.flexHole, 'z');
    addCylinder(group, [boreR + 0.007, boreR + 0.007, 0.008], [0, y, half], mats.sensorFace, 'z');
    addCylinder(group, [boreR + 0.007, boreR + 0.007, 0.008], [0, y, -half], mats.sensorFace, 'z');
  });
  addBox(group, [0.03, 0.104, thru], [0, 0, 0], mats.flexHole);
  addBox(group, [0.044, 0.116, 0.008], [0, 0, half], mats.sensorFace);
  addBox(group, [0.044, 0.116, 0.008], [0, 0, -half], mats.sensorFace);

  // 3) Mounting holes: smaller M4 pair at the load end (-Y), larger M5 pair at
  //    the fixed/cable end (+Y); through the thickness, with dark rims.
  function thruHole(y, r) {
    addCylinder(group, [r, r, thru], [0, y, 0], mats.flexHole, 'z');
    addCylinder(group, [r + 0.009, r + 0.009, 0.006], [0, y, half], mats.darkMetal, 'z');
    addCylinder(group, [r + 0.009, r + 0.009, 0.006], [0, y, -half], mats.darkMetal, 'z');
  }
  thruHole(-0.355, 0.02);
  thruHole(-0.205, 0.02);
  thruHole(0.205, 0.025);
  thruHole(0.355, 0.025);

  // 4) HTC logo box + 10 kg capacity printed on the front face near the load end.
  addDecal(group, 'HTC', [0, -0.255, half + 0.004], [0, 0, 0], 0.072, '#F2F2F0', '#1B3A6B');
  addDecal(group, '10kg', [0, -0.32, half + 0.004], [0, 0, 0], 0.078, '#16324a', null);

  // 5) Strain-gauge / potting band over the thinned section (both faces) + the
  //    front/rear-tinted gauge pad.
  addRoundedBox(group, [0.09, 0.2, 0.004], [0, 0.02, half + 0.002], mats.darkMetal, 0.002);
  addRoundedBox(group, [0.09, 0.2, 0.004], [0, 0.02, -half - 0.002], mats.darkMetal, 0.002);
  addRoundedBox(group, [0.06, 0.1, 0.006], [0, 0.02, half + 0.004], accent, 0.002);

  // 6) Cable grommet on the +Y end + the 4-conductor color tail.
  addCylinder(group, [0.013, 0.013, 0.024], [0, 0.412, 0], mats.jacket, 'y');
  addTubeWire(group, [
    [0, 0.42, 0],
    [0.03, 0.47, 0.03],
    [0.08, 0.5, 0.06],
    [0.13, 0.46, 0.09],
    [0.17, 0.38, 0.11],
  ], mats.jacket, 0.013);
  const tip = [0.17, 0.38, 0.11];
  const wireDefs = [
    { m: mats.wRed, off: [0.02, -0.04, 0.015] },
    { m: mats.wGreen, off: [0.035, -0.06, -0.01] },
    { m: mats.wBlack, off: [-0.01, -0.07, 0.02] },
    { m: mats.wWhite, off: [0.05, -0.05, 0.005] },
  ];
  wireDefs.forEach((w) => {
    addTubeWire(group, [
      tip,
      [tip[0] + w.off[0] * 0.5, tip[1] + w.off[1] * 0.5, tip[2] + w.off[2] * 0.5],
      [tip[0] + w.off[0], tip[1] + w.off[1], tip[2] + w.off[2]],
      [tip[0] + w.off[0] * 1.6, tip[1] + w.off[1] * 1.7, tip[2] + w.off[2] * 1.3],
    ], w.m, 0.005);
  });

  return group;
}

function createSBeamLoadCell(mats) {
  // TAS501 200 kg S-type (S-beam) load cell, HT Sensor Technology.
  // Load axis = X (76 mm = 0.76u), Y up (51 mm = 0.51u), Z depth (19 mm).
  // Built additively: steel only where solid, with genuine gaps where the two
  // opposing slots are, and a single diagonal web tying the ends = the S.
  const group = new THREE.Group();
  const W = 0.76, H = 0.51, D = 0.19;
  const halfW = W / 2;
  const steel = mats.nickelSteel;

  // 1) Solid end bosses (where the rod-ends bolt in via the M12 axial holes).
  const bossX = 0.15;
  const bossCenter = halfW - bossX / 2;
  addRoundedBox(group, [bossX, H, D], [bossCenter, 0, 0], steel, 0.015);
  addRoundedBox(group, [bossX, H, D], [-bossCenter, 0, 0], steel, 0.015);

  // 2) The S-form: short top/bottom rail stubs with open gaps + a slanted
  //    central flexure web + alternating tie columns (one continuous S of steel).
  const railH = 0.085;
  const topY = H / 2 - railH / 2;
  const botY = -(H / 2 - railH / 2);
  addRoundedBox(group, [0.18, railH, D], [-0.14, topY, 0], steel, 0.01);
  addRoundedBox(group, [0.07, railH, D], [0.195, topY, 0], steel, 0.01);
  addRoundedBox(group, [0.18, railH, D], [0.14, botY, 0], steel, 0.01);
  addRoundedBox(group, [0.07, railH, D], [-0.195, botY, 0], steel, 0.01);
  const web = addRoundedBox(group, [0.46, 0.095, D], [0, 0, 0], steel, 0.008);
  web.rotation.z = 0.27; // ~15 deg diagonal ligament
  addRoundedBox(group, [0.1, 0.26, D], [-0.155, 0.085, 0], steel, 0.01);
  addRoundedBox(group, [0.1, 0.26, D], [0.155, -0.085, 0], steel, 0.01);

  // 3) The two opposing slots as dark recesses dropped into the real gaps.
  const slotLen = 0.27, slotH = 0.085, slotZ = D * 0.9;
  addBox(group, [slotLen, slotH, slotZ], [0.085, 0.135, 0], mats.darkMetal);
  addBox(group, [slotLen, slotH, slotZ], [-0.085, -0.135, 0], mats.darkMetal);
  addBox(group, [slotLen * 0.9, slotH * 0.55, slotZ * 0.55], [0.085, 0.135, 0], mats.flexHole);
  addBox(group, [slotLen * 0.9, slotH * 0.55, slotZ * 0.55], [-0.085, -0.135, 0], mats.flexHole);

  // 4) Slot-end stress-relief holes (drilled through Z).
  addCylinder(group, [0.028, 0.028, D * 1.04], [-0.05, 0.135, 0], mats.flexHole, 'z');
  addCylinder(group, [0.028, 0.028, D * 1.04], [0.22, 0.135, 0], mats.flexHole, 'z');
  addCylinder(group, [0.028, 0.028, D * 1.04], [0.05, -0.135, 0], mats.flexHole, 'z');
  addCylinder(group, [0.028, 0.028, D * 1.04], [-0.22, -0.135, 0], mats.flexHole, 'z');

  // 5) M12 female axial threaded bores on the X load axis (both end faces).
  [1, -1].forEach((s) => {
    const faceX = s * halfW;
    addCylinder(group, [0.085, 0.085, 0.012], [faceX - s * 0.006, 0, 0], steel, 'x');
    addCylinder(group, [0.062, 0.062, 0.012], [faceX - s * 0.014, 0, 0], mats.darkMetal, 'x');
    addCylinder(group, [0.058, 0.058, 0.12], [faceX - s * 0.075, 0, 0], mats.flexHole, 'x');
    for (let i = 0; i < 4; i += 1) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.056, 0.006, 8, 20), mats.darkMetal);
      ring.position.set(faceX - s * (0.022 + i * 0.026), 0, 0);
      ring.rotation.y = Math.PI / 2;
      group.add(ring);
    }
  });

  // 6) Cable gland on top of the +X boss, 7) trailing grey 4-core cable.
  const glandX = bossCenter + 0.01;
  const glandZ = 0.045;
  const topFaceY = H / 2;
  addCylinder(group, [0.05, 0.055, 0.04], [glandX, topFaceY + 0.02, glandZ], steel, 'y');
  addCylinder(group, [0.045, 0.05, 0.1], [glandX, topFaceY + 0.09, glandZ], mats.darkMetal, 'y');
  addCylinder(group, [0.042, 0.045, 0.022], [glandX, topFaceY + 0.155, glandZ], steel, 'y');
  const tipY = topFaceY + 0.17;
  addTubeWire(group, [
    [glandX, tipY, glandZ],
    [glandX + 0.03, tipY + 0.16, glandZ + 0.04],
    [glandX + 0.12, tipY + 0.3, glandZ + 0.02],
    [glandX + 0.28, tipY + 0.38, glandZ - 0.06],
    [glandX + 0.46, tipY + 0.34, glandZ - 0.12],
    [glandX + 0.62, tipY + 0.2, glandZ - 0.1],
  ], mats.cableGrey, 0.026);

  // 8) White spec label on the front (+Z) face of the central web.
  const labelZ = D / 2 + 0.003;
  addRoundedBox(group, [0.36, 0.26, 0.004], [0, 0, labelZ], mats.sticker, 0.012);
  addBox(group, [0.045, 0.045, 0.003], [-0.145, -0.088, labelZ + 0.003], mats.darkMetal);
  const tZ = labelZ + 0.004;
  addDecal(group, 'Model: TAS501', [0, 0.09, tZ], [0, 0, 0], 0.3, '#16203A', null);
  addDecal(group, 'Capacity: 200kg', [0, 0.046, tZ], [0, 0, 0], 0.3, '#16203A', null);
  addDecal(group, 'Accuracy: C3', [0, 0.004, tZ], [0, 0, 0], 0.24, '#16203A', null);
  addDecal(group, 'HT Sensor Technology', [0.02, -0.042, tZ], [0, 0, 0], 0.3, '#16203A', null);
  addDecal(group, 'WWW.HTC-SENSOR.COM', [0, -0.09, tZ], [0, 0, 0], 0.26, '#2A52C9', null);

  return group;
}

// Round, shaded tube along a path of points - reads as a real wire/cable.
function addTubeWire(group, points, material, radius = 0.008) {
  const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
  const geometry = new THREE.TubeGeometry(curve, 22, radius, 6, false);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  group.add(mesh);
  return mesh;
}

function addWireTail(group, start, mats, length) {
  // Molded strain-relief boot where the cable leaves the cell body.
  addCylinder(group, [0.022, 0.026, 0.05], [start[0] + 0.02, start[1], start[2]], mats.jacket, 'x');
  const wireMats = [mats.wRed, mats.wBlack, mats.wGreen, mats.wWhite];
  const lift = [0.013, 0.004, -0.005, -0.013];
  wireMats.forEach((material, index) => {
    const s = [start[0] + 0.04, start[1] + lift[index], start[2] + (index - 1.5) * 0.01];
    addTubeWire(
      group,
      [
        s,
        [s[0] + length * 0.32, s[1] - 0.05 - index * 0.004, s[2] + 0.02],
        [s[0] + length * 0.7, s[1] - 0.11 + index * 0.004, s[2] + 0.05 - index * 0.012],
        [s[0] + length, s[1] - 0.09 + index * 0.005, s[2] + 0.08 - index * 0.016],
      ],
      material,
      0.0075
    );
  });
}

function addDragLinkage(root, mats) {
  addCylinder(root, [0.019, 0.019, 0.64], [0.76, -0.1, -0.48], mats.darkMetal, 'x');
  addCylinder(root, [0.019, 0.019, 0.72], [1.48, -0.1, -0.48], mats.darkMetal, 'x');
}

function createDaqAndLaptop(mats) {
  const group = new THREE.Group();
  [-0.24, 0, 0.24].forEach((z, index) => {
    const board = withRealModel('hx711', createHx711(mats));
    board.position.set(0, 0.05, z);
    group.add(board);
    // a wire bundle running off toward the cells
    addTubeWire(
      group,
      [
        [-0.17, 0.06, z],
        [-0.28, 0.09, z - 0.04],
        [-0.36, 0.07 + index * 0.02, z - 0.06],
      ],
      mats.wGreen,
      0.006
    );
  });
  addBox(group, [0.55, 0.03, 0.38], [0.72, -0.08, 0.03], mats.darkMetal);
  addBox(group, [0.5, 0.27, 0.025], [0.72, 0.09, -0.15], new THREE.MeshStandardMaterial({ color: 0xdff5ff, roughness: 0.2 }));
  return group;
}

// SparkFun-style HX711 amplifier board: red PCB, SOIC chip, passives, and two
// header rows (load-cell side: E+/E-/A-/A+/B-/B+, MCU side: VCC/DT/SCK/GND).
function createHx711(mats) {
  // SparkFun HX711 Load Cell Amplifier (SEN-13879). Real PCB ~34 x 21 x 1.6 mm
  // -> 0.34 x 0.016 x 0.21 u. Long axis along X, board flat, top face at +Y.
  const group = new THREE.Group();
  const BOARD_H = 0.016;
  const TOP = BOARD_H / 2;
  const PADY = TOP + 0.0006;
  const SILK = TOP + 0.0008;
  const HEADER_Z = 0.09;

  // 1) The signature bright SparkFun-red PCB.
  addRoundedBox(group, [0.34, BOARD_H, 0.21], [0, 0, 0], mats.hx711Board, 0.012);

  // 2) HX711 SOIC-16 chip, proud of the board, offset toward the -X end.
  const chipX = -0.075;
  const chipH = 0.011;
  const chipCY = TOP + chipH / 2;
  addRoundedBox(group, [0.1, chipH, 0.039], [chipX, chipCY, 0], mats.chip, 0.0015);
  addDecal(group, 'HX711', [chipX, TOP + chipH + 0.0002, 0], [-Math.PI / 2, 0, 0], 0.055, '#D8D8D8', null);
  addCylinder(group, [0.0028, 0.0028, 0.0006], [chipX - 0.04, TOP + chipH + 0.0002, -0.013], mats.sticker, 'y');
  // Silver gull-wing leads on both long sides of the SOIC.
  const leadPitch = 0.0127;
  const leadStartX = chipX - 3.5 * leadPitch;
  const leadZ = 0.039 / 2 + 0.008;
  const leadY = TOP + 0.0012;
  for (let i = 0; i < 8; i += 1) {
    const lx = leadStartX + i * leadPitch;
    addBox(group, [0.005, 0.0018, 0.016], [lx, leadY, leadZ], mats.tin);
    addBox(group, [0.005, 0.0018, 0.016], [lx, leadY, -leadZ], mats.tin);
  }

  // 3) Pin headers on OPPOSITE long edges - the 6-vs-5 asymmetry.
  function buildHeader(count, edgeZ) {
    const pitch = 0.0254;
    const span = (count - 1) * pitch;
    const startX = -span / 2;
    const stripTop = TOP + 0.01;
    addBox(group, [span + 0.014, 0.01, 0.022], [0, TOP + 0.005, edgeZ], mats.black);
    for (let i = 0; i < count; i += 1) {
      const px = startX + i * pitch;
      addBox(group, [0.0055, 0.02, 0.0055], [px, stripTop + 0.01, edgeZ], mats.gold);
      addCylinder(group, [0.009, 0.009, 0.0006], [px, PADY, edgeZ], mats.gold, 'y');
    }
  }
  buildHeader(6, HEADER_Z); // load-cell header: E+ E- A- A+ B- B+
  buildHeader(5, -HEADER_Z); // logic header:    GND DAT CLK VCC VDD

  // 4) Passives around the chip (tan MLCC caps + black chip resistors).
  [[0.005, 0.022], [0.03, -0.014], [0.048, 0.03], [-0.01, -0.03]].forEach(([cx, cz]) => {
    addRoundedBox(group, [0.018, 0.007, 0.01], [cx, TOP + 0.0035, cz], mats.tanCeramicCap, 0.001);
  });
  [[0.075, -0.03], [0.1, 0.018], [0.055, 0.052]].forEach(([rx, rz]) => {
    addRoundedBox(group, [0.016, 0.006, 0.008], [rx, TOP + 0.003, rz], mats.chip, 0.0008);
    addBox(group, [0.003, 0.0065, 0.0085], [rx - 0.0075, TOP + 0.003, rz], mats.tin);
    addBox(group, [0.003, 0.0065, 0.0085], [rx + 0.0075, TOP + 0.003, rz], mats.tin);
  });

  // 5) A few scattered gold vias.
  [[0.15, -0.06], [0.15, 0.06], [-0.15, 0.06], [-0.15, -0.06], [0.12, -0.005]].forEach(([vx, vz]) => {
    addCylinder(group, [0.004, 0.004, 0.0006], [vx, PADY, vz], mats.gold, 'y');
  });

  // 6) Silkscreen - the labels that make it specifically an HX711.
  addDecal(group, 'E+  E-  A-  A+  B-  B+', [0, SILK, 0.07], [-Math.PI / 2, 0, 0], 0.18, '#F2F2F2', null);
  addDecal(group, 'RED  BLK  WHT  GRN', [0, SILK, 0.052], [-Math.PI / 2, 0, 0], 0.12, '#F2F2F2', null);
  addDecal(group, 'GND  DAT  CLK  VCC  VDD', [0, SILK, -0.07], [-Math.PI / 2, 0, 0], 0.16, '#F2F2F2', null);
  addDecal(group, 'SparkFun', [0.11, SILK, 0], [-Math.PI / 2, 0, 0], 0.07, '#F2F2F2', null);
  addDecal(group, 'SEN-13879  Load Cell Amp', [0.095, SILK, -0.03], [-Math.PI / 2, 0, 0], 0.1, '#F2F2F2', null);

  return group;
}

function addLoadCellDemo(root, mats) {
  const demo = new THREE.Group();
  demo.position.set(0.55, 0.68, 0.72);
  demo.scale.set(1.08, 1.08, 1.08);
  demo.add(createSBeamLoadCell(mats));
  root.add(demo);
  addForceArrow(root, [0.55, 0.68, 1.25], [0, 0, -1], 0.34, 0xda3f48);
  addForceArrow(root, [0.55, 0.68, 0.22], [0, 0, 1], 0.34, 0xda3f48);
}

function addForceArrows(root) {
  addForceArrow(root, [-0.48, -0.05, 0.35], [0, 1, 0], 0.9, 0x1479c9);
  addForceArrow(root, [0.48, -0.05, 0.35], [0, 1, 0], 0.9, 0x33aaf3);
  addForceArrow(root, [-0.72, 0.94, -0.52], [1, 0, 0], 1.05, 0xda3f48);

  const points = [];
  const center = new THREE.Vector3(0.05, 0.98, 0.62);
  for (let i = 0; i <= 44; i += 1) {
    const t = 0.15 * Math.PI + (i / 44) * 1.35 * Math.PI;
    points.push(new THREE.Vector3(center.x + Math.cos(t) * 0.36, center.y + Math.sin(t) * 0.36, center.z));
  }
  const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 48, 0.013, 8, false), new THREE.MeshStandardMaterial({ color: 0x7651d1 }));
  root.add(tube);
}

function addWiring(root, mats, exploded) {
  // Neat round cables drooping from each cell to the HX711/DAQ hub. Starts are
  // matched to the actual cell + DAQ positions in each scene.
  const hub = [exploded ? 1.72 : 1.78, exploded ? -0.32 : -0.46, exploded ? -1.1 : -1.02];
  const starts = [
    [exploded ? -0.72 : -0.46, exploded ? -0.34 : -0.44, exploded ? 0.78 : 0.18],
    [exploded ? 0.72 : 0.46, exploded ? -0.34 : -0.44, exploded ? 0.78 : 0.18],
    [exploded ? 1.45 : 1.18, exploded ? -0.05 : -0.16, exploded ? 0.45 : -0.5],
  ];
  starts.forEach((s, i) => {
    addTubeWire(
      root,
      [
        s,
        [s[0], s[1] - 0.05, s[2]],
        [(s[0] + hub[0]) / 2, hub[1] - 0.03, (s[2] + hub[2]) / 2 + i * 0.03],
        [hub[0] - 0.14, hub[1] + 0.02, hub[2] + 0.05 + i * 0.05],
        [hub[0], hub[1] + 0.05, hub[2] + i * 0.05],
      ],
      mats.jacket,
      0.012
    );
  });
}

function addAssemblyGuides(root, mats) {
  addLine(root, [[-0.08, 0.82, 0], [-0.08, -0.42, 0]], new THREE.LineDashedMaterial({ color: 0x1479c9, dashSize: 0.08, gapSize: 0.04 }));
  addLabel(root, 'load path', [-0.12, 0.5, 0.5], '#1479c9');
}

function addLabels(root, sceneMode) {
  if (sceneMode === 'cell') {
    addLabel(root, 'force must be inline', [0.8, 1.02, 0.82], '#9b242d');
    addLabel(root, 'strain section flexes', [0.42, 0.38, 0.92], '#334657');
    return;
  }
  if (sceneMode === 'forces') {
    addLabel(root, 'TAL220 lift bars', [-0.12, 0.88, 0.72], '#1479c9');
    addLabel(root, 'TAS501 drag', [0.82, 0.24, -0.62], '#9b242d');
    addLabel(root, 'pitch moment', [0.12, 1.34, 0.58], '#7651d1');
    return;
  }
  if (sceneMode === 'exploded') {
    addLabel(root, '1 - Aircraft (in the airflow)', [-0.82, 1.72, -0.12], '#334657');
    addLabel(root, '2 - Sting (only thing in the wind)', [-0.9, 0.66, -1.05], '#334657');
    addLabel(root, '3 - Moving plate', [-0.1, 0.34, -1.12], '#1479c9');
    addLabel(root, '4 - Load cells (2 lift + 1 drag)', [0.1, -0.12, 1.02], '#1479c9');
    addLabel(root, '5 - HX711 -> Arduino', [1.72, 0.08, -1.4], '#334657');
    addLabel(root, '6 - Rigid frame, bolted down', [-1.2, -0.5, -1.0], '#9b242d');
    return;
  }
  if (sceneMode === 'wiring') {
    addLabel(root, 'load cells stay below airflow', [-0.35, -0.68, -0.9], '#334657');
    addLabel(root, 'signal wires to HX711 boards', [1.1, 0.15, -1.28], '#0b7890');
    return;
  }
  addLabel(root, '2x TAL220 - lift + pitch', [-0.02, -0.12, 0.66], '#1479c9');
  addLabel(root, 'TAS501 - drag', [1.06, 0.26, -0.42], '#9b242d');
  addLabel(root, '3x HX711', [1.78, 0.18, -0.5], '#334657');
}

function addTunnel(root) {
  const tunnel = new THREE.Mesh(
    new THREE.BoxGeometry(3.8, 1.72, 2.42),
    new THREE.MeshBasicMaterial({ color: 0xbfeeff, transparent: true, opacity: 0.045, side: THREE.BackSide })
  );
  tunnel.position.set(0.05, 0.38, 0);
  tunnel.userData.fitIgnore = true;
  root.add(tunnel);
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(tunnel.geometry),
    new THREE.LineBasicMaterial({ color: 0x9bc8e2, transparent: true, opacity: 0.65 })
  );
  edges.position.copy(tunnel.position);
  root.add(edges);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 3.0), new THREE.MeshStandardMaterial({ color: 0xecf6fc, roughness: 0.88 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.72;
  floor.receiveShadow = true;
  floor.userData.fitIgnore = true;
  root.add(floor);
  addForceArrow(root, [-1.65, 1.26, -0.98], [1, 0, 0], 0.86, 0x129fd2);
  addLabel(root, 'airflow', [-1.08, 1.45, -1.0], '#17799d');
}

function addFrame(root, mats, exploded) {
  if (exploded) {
    addRail(root, 'x', 2.6, [0.1, -0.66, -0.85], mats);
    addRail(root, 'x', 2.6, [0.1, -0.66, 0.85], mats);
    addRail(root, 'z', 1.7, [-1.2, -0.66, 0], mats);
    addRail(root, 'z', 1.7, [1.4, -0.66, 0], mats);
    return;
  }
  addRail(root, 'x', 2.6, [0.1, -0.66, -0.85], mats);
  addRail(root, 'x', 2.6, [0.1, -0.66, 0.85], mats);
  addRail(root, 'z', 1.7, [-1.2, -0.66, 0], mats);
  addRail(root, 'z', 1.7, [1.4, -0.66, 0], mats);
  addRail(root, 'y', 0.55, [-1.2, -0.38, -0.85], mats);
  addRail(root, 'y', 0.55, [1.4, -0.38, -0.85], mats);
  addRail(root, 'y', 0.55, [-1.2, -0.38, 0.85], mats);
  addRail(root, 'y', 0.55, [1.4, -0.38, 0.85], mats);
  addBox(root, [0.1, 0.06, 0.28], [-0.48, -0.2, 0], mats.darkMetal);
  addBox(root, [0.1, 0.06, 0.28], [0.48, -0.2, 0], mats.darkMetal);
  addBox(root, [0.1, 0.22, 0.1], [-0.83, -0.45, -0.7], mats.darkMetal);
  addBox(root, [0.1, 0.22, 0.1], [0.83, -0.45, -0.7], mats.darkMetal);
}

function addRail(parent, axis, length, position, mats) {
  const size = axis === 'x' ? [length, 0.08, 0.08] : axis === 'z' ? [0.08, 0.08, length] : [0.08, length, 0.08];
  addBox(parent, size, position, mats.aluminum);
  const grooveMat = mats.darkMetal;
  if (axis === 'x') {
    addBox(parent, [length * 0.96, 0.012, 0.01], [position[0], position[1] + 0.044, position[2] + 0.041], grooveMat);
    addBox(parent, [length * 0.96, 0.012, 0.01], [position[0], position[1] + 0.044, position[2] - 0.041], grooveMat);
  }
  if (axis === 'z') {
    addBox(parent, [0.01, 0.012, length * 0.96], [position[0] + 0.041, position[1] + 0.044, position[2]], grooveMat);
    addBox(parent, [0.01, 0.012, length * 0.96], [position[0] - 0.041, position[1] + 0.044, position[2]], grooveMat);
  }
}

function addBoltPattern(parent, center, mats) {
  const offsets = [
    [-0.045, 0, -0.045],
    [0.045, 0, -0.045],
    [-0.045, 0, 0.045],
    [0.045, 0, 0.045],
  ];
  offsets.forEach(([x, y, z]) => addCylinder(parent, [0.014, 0.014, 0.012], [center[0] + x, center[1] + y, center[2] + z], mats.darkMetal, 'y'));
}

// Paints text/markings onto a small plane laid on a part face - used for PCB
// silkscreen, capacity stickers, and logos so each model is clearly identifiable.
// position/rotation in scene units & radians; widthUnits sets the decal width;
// bg null = transparent background.
function addDecal(parent, text, position, rotation = [0, 0, 0], widthUnits = 0.2, fg = '#0f1f2e', bg = null) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const fontPx = 64;
  const font = `700 ${fontPx}px Inter, Arial, sans-serif`;
  ctx.font = font;
  const textWidth = Math.max(1, ctx.measureText(text).width);
  const pad = 22;
  canvas.width = Math.ceil(textWidth + pad * 2);
  canvas.height = Math.ceil(fontPx + pad * 2);
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.fillStyle = fg;
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const aspect = canvas.height / canvas.width;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(widthUnits, widthUnits * aspect),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    })
  );
  mesh.position.set(...position);
  mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  parent.add(mesh);
  return mesh;
}

// Draws a dimensioned scale bar with end ticks plus a text label. The scene is
// modeled at 1 unit = 100 mm, so a length of 1.0 reads "100 mm".
function addScaleBar(root, length, position, text) {
  const [x, y, z] = position;
  const mat = new THREE.MeshBasicMaterial({ color: 0x16324a });
  const parts = [
    addBox(root, [length, 0.014, 0.014], [x, y, z], mat),
    addBox(root, [0.014, 0.05, 0.014], [x - length / 2, y + 0.018, z], mat),
    addBox(root, [0.014, 0.05, 0.014], [x + length / 2, y + 0.018, z], mat),
  ];
  parts.forEach((mesh) => {
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.userData.fitIgnore = true; // keep the ruler out of the camera auto-fit
  });
  addLabel(root, text, [x, y + 0.13, z], '#16324a');
}

function addBox(parent, size, position, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addRoundedBox(parent, size, position, material, radius = 0.02) {
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(size[0], size[1], size[2], 4, radius), material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addCylinder(parent, size, position, material, axis = 'y') {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(size[0], size[1], size[2], 32), material);
  mesh.position.set(...position);
  if (axis === 'x') mesh.rotation.z = Math.PI / 2;
  if (axis === 'z') mesh.rotation.x = Math.PI / 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addCone(parent, args, position, material, zRotation) {
  const mesh = new THREE.Mesh(new THREE.ConeGeometry(...args), material);
  mesh.position.set(...position);
  mesh.rotation.z = zRotation;
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function addScaledSphere(parent, scale, position, material) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), material);
  mesh.scale.set(...scale);
  mesh.position.set(...position);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function addLine(parent, coords, material) {
  const geometry = new THREE.BufferGeometry().setFromPoints(coords.map((coord) => new THREE.Vector3(...coord)));
  const line = new THREE.Line(geometry, material);
  if (material.isLineDashedMaterial) {
    line.computeLineDistances();
  }
  parent.add(line);
}

function addForceArrow(parent, origin, direction, length, color) {
  const arrow = new THREE.ArrowHelper(
    new THREE.Vector3(...direction).normalize(),
    new THREE.Vector3(...origin),
    length,
    color,
    length * 0.18,
    length * 0.09
  );
  arrow.userData.fitIgnore = true; // keep arrows out of the camera auto-fit
  parent.add(arrow);
}

function addLabel(parent, text, position, color) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const padding = 14;
  context.font = '700 21px Inter, Arial, sans-serif';
  const width = Math.ceil(context.measureText(text).width + padding * 2);
  const height = 42;
  canvas.width = width;
  canvas.height = height;
  context.font = '700 21px Inter, Arial, sans-serif';
  context.fillStyle = 'rgba(255,255,255,0.92)';
  roundRect(context, 0, 0, width, height, 10);
  context.fill();
  context.strokeStyle = 'rgba(133,184,214,0.78)';
  context.lineWidth = 2;
  roundRect(context, 1, 1, width - 2, height - 2, 10);
  context.stroke();
  context.fillStyle = color;
  context.fillText(text, padding, 28);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  // depthTest off + high renderOrder keeps labels readable even when a part of
  // the rig sits in front of them.
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false })
  );
  sprite.renderOrder = 20;
  sprite.userData.fitIgnore = true;
  sprite.position.set(...position);
  sprite.scale.set(width / 260, height / 260, 1);
  parent.add(sprite);
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

createRoot(document.getElementById('root')).render(<App />);
