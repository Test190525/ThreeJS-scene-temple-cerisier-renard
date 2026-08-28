import { Suspense, useEffect, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, Html, Sky, Sparkles, KeyboardControls } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import {
  Physics,
  RigidBody,
  CuboidCollider,
  CylinderCollider,
} from "@react-three/rapier";
import { Leva, useControls, folder } from "leva";
import Model from "./Model";
import StoneLamp from "./StoneLamp";
import Fox from "./Fox";
import "./App.css";

const FOX_URL = "/model/Fox.glb";
const PAGODA_URL = "/model/Pagoda.glb";
const TORII_URL = "/model/Torii%20Gate.glb";
const TREE_URL = "/model/Tree.glb";

// Redressement du torii, stocké tourné de ~47° dans son .glb
const TORII_Y_ROTATION = ((47 + 180) * Math.PI) / 180;

// Positions des lanternes le long de l'allée
const LAMP_POSITIONS = [
  [-4.5, 0, 7],
  [4.5, 0, 7],
  [-4.5, 0, 2],
  [4.5, 0, 2],
  [-4.5, 0, -3],
  [4.5, 0, -3],
];

// Demi-côté du sol
const GROUND_HALF = 20;
// Demi-côté de la boîte d'ombre du soleil
const SHADOW_HALF = 29;
// Distance du soleil au centre de la scène
const SUN_DISTANCE = 45;
// Inclinaison de l'arc décrit par le soleil
const SUN_TILT = 0.6;
// Lumière ambiante restante la nuit
const NIGHT_AMBIENT = 0.08;
// Part de la couleur de brume conservée la nuit
const NIGHT_FOG = 0.12;
// Élévations du soleil entre lesquelles les lanternes s'allument
const LAMP_OFF_ELEVATION = 0.25;
const LAMP_ON_ELEVATION = -0.05;

// Touches ZQSD et flèches ("KeyW" est le code du Z sur un AZERTY)
const KEYBOARD_MAP = [
  { name: "forward", keys: ["ArrowUp", "KeyW", "z", "Z"] },
  { name: "backward", keys: ["ArrowDown", "KeyS", "s", "S"] },
  { name: "left", keys: ["ArrowLeft", "KeyA", "q", "Q"] },
  { name: "right", keys: ["ArrowRight", "KeyD", "d", "D"] },
  { name: "run", keys: ["ShiftLeft", "ShiftRight"] },
];

useGLTF.preload(FOX_URL);
useGLTF.preload(PAGODA_URL);
useGLTF.preload(TORII_URL);
useGLTF.preload(TREE_URL);

// Écran de chargement des modèles
function Loader() {
  return <Html center>Chargement…</Html>;
}

// Sol : plan visible et dalle épaisse invisible pour la physique
function Floor() {
  return (
    <RigidBody type="fixed" colliders={false}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#cfc6bd" />
      </mesh>
      <CuboidCollider args={[GROUND_HALF, 0.5, GROUND_HALF]} position={[0, -0.5, 0]} />
    </RigidBody>
  );
}

// Murs invisibles aux bords du sol
function Walls() {
  return (
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider args={[GROUND_HALF, 3, 0.5]} position={[0, 3, GROUND_HALF]} />
      <CuboidCollider args={[GROUND_HALF, 3, 0.5]} position={[0, 3, -GROUND_HALF]} />
      <CuboidCollider args={[0.5, 3, GROUND_HALF]} position={[GROUND_HALF, 3, 0]} />
      <CuboidCollider args={[0.5, 3, GROUND_HALF]} position={[-GROUND_HALF, 3, 0]} />
    </RigidBody>
  );
}

// Élément de décor fixe ; trimesh permet de passer sous le torii
function StaticModel({ colliders = "trimesh", ...props }) {
  return (
    <RigidBody type="fixed" colliders={colliders}>
      <Model {...props} />
    </RigidBody>
  );
}

// Lanterne de pierre et son collider cylindrique
function PhysicalLamp({ position, scale, ...props }) {
  const height = 3.04 * scale;
  return (
    <>
      <RigidBody type="fixed" colliders={false} position={position}>
        <CylinderCollider args={[height / 2, 0.47 * scale]} position={[0, height / 2, 0]} />
      </RigidBody>
      <StoneLamp position={position} scale={scale} {...props} />
    </>
  );
}

// Caméra troisième personne, dans le dos du renard
function FollowCamera({ target, distance, height }) {
  const angle = useRef(Math.PI);

  useFrame(({ camera }, delta) => {
    const { p, heading } = target.current;

    // écart ramené dans [-PI, PI] : on contourne par le chemin le plus court
    let diff = heading - angle.current;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    angle.current += diff * Math.min(1, delta * 3);

    camera.position.set(
      p.x - Math.sin(angle.current) * distance,
      p.y + height,
      p.z - Math.cos(angle.current) * distance
    );
    camera.lookAt(p.x, p.y + 0.5, p.z);
  });
  return null;
}

// Cycle jour/nuit : soleil, ombres, ambiante, brume et allumage des lanternes.
// Tout est muté par ref pour ne pas relancer de rendu React à chaque frame.
function SunCycle({
  light,
  sky,
  ambient,
  fog,
  fogColor,
  night,
  note,
  startHour,
  speed,
  intensity,
  dayAmbient,
}) {
  const hours = useRef(startHour);

  useEffect(() => {
    hours.current = startHour;
  }, [startHour]);

  useFrame((state, delta) => {
    hours.current = (hours.current + delta * speed) % 24;

    // 6 h = lever à l'est, 12 h = plus haut point, 18 h = coucher à l'ouest
    const a = ((hours.current - 6) / 12) * Math.PI;
    const elevation = Math.sin(a);
    const day = Math.max(0, elevation);
    const dir = [
      Math.cos(a),
      elevation * Math.cos(SUN_TILT),
      elevation * Math.sin(SUN_TILT),
    ];

    // Soleil : direction des ombres, éteint sous l'horizon
    if (light.current) {
      light.current.position.set(
        dir[0] * SUN_DISTANCE,
        dir[1] * SUN_DISTANCE,
        dir[2] * SUN_DISTANCE
      );
      light.current.intensity = intensity * day;
    }

    // Ciel : le shader normalise sunPosition, seule la direction compte
    const sun = sky.current?.material?.uniforms?.sunPosition;
    if (sun) sun.value.set(...dir);

    if (ambient.current) {
      ambient.current.intensity = NIGHT_AMBIENT + (dayAmbient - NIGHT_AMBIENT) * day;
    }

    // Montée des lanternes, lissée en smoothstep
    const t = Math.min(
      1,
      Math.max(0, (LAMP_OFF_ELEVATION - elevation) / (LAMP_OFF_ELEVATION - LAMP_ON_ELEVATION))
    );
    night.current = t * t * (3 - 2 * t);

    // La note s'efface au rythme où les lanternes montent
    if (note.current) note.current.style.opacity = 1 - night.current;

    // Brume : même teinte, assombrie avec le soleil
    if (fog.current) {
      fog.current.color.set(fogColor).multiplyScalar(NIGHT_FOG + (1 - NIGHT_FOG) * day);
    }
  });

  return null;
}

export default function App() {
  // Position et cap du renard, relus par la caméra
  const fox = useRef({ p: { x: 0, y: 0, z: 13 }, heading: Math.PI });

  // Mutés à chaque frame par SunCycle
  const sunLight = useRef();
  const sky = useRef();
  const ambient = useRef();
  const fog = useRef();
  // 0 en plein jour, 1 une fois le soleil couché
  const night = useRef(0);
  const note = useRef();

  // Réglages du panneau Leva
  const {
    petalCount,
    petalSize,
    petalSpeed,
    petalColor,
    fogColor,
    fogNear,
    fogFar,
    lampScale,
    lampColor,
    lampGlow,
    lampLight,
    lampFlicker,
    bloomIntensity,
    bloomThreshold,
    bloomRadius,
    vignetteDarkness,
    vignetteOffset,
    startHour,
    cycleMinutes,
    paused,
    sunIntensity,
    dayAmbient,
    gravity,
    debugPhysics,
    walkSpeed,
    runSpeed,
    turnSpeed,
    camDistance,
    camHeight,
  } = useControls({
    "Pétales": folder({
      petalCount: { value: 120, min: 0, max: 500, step: 10, label: "quantité" },
      petalSize: { value: 6, min: 1, max: 20, step: 0.5, label: "taille" },
      petalSpeed: { value: 0.4, min: 0, max: 3, step: 0.05, label: "vitesse" },
      petalColor: { value: "#ff9ec4", label: "couleur" },
    }),
    "Brume": folder({
      fogColor: { value: "#f3d6e6", label: "couleur" },
      fogNear: { value: 12, min: 0, max: 50, step: 1, label: "début" },
      fogFar: { value: 40, min: 1, max: 100, step: 1, label: "fin" },
    }),
    "Lanternes": folder({
      lampScale: { value: 0.6, min: 0.2, max: 1.5, step: 0.05, label: "taille" },
      lampColor: { value: "#ffb861", label: "couleur flamme" },
      lampGlow: { value: 4.5, min: 1, max: 15, step: 0.5, label: "intensité vitres" },
      lampLight: { value: 7.5, min: 0, max: 30, step: 0.5, label: "portée lumière" },
      lampFlicker: { value: false, label: "vacillement" },
    }),
    "Bloom": folder({
      bloomIntensity: { value: 0.2, min: 0, max: 5, step: 0.1, label: "intensité" },
      bloomThreshold: { value: 1.65, min: 0, max: 2, step: 0.05, label: "seuil" },
      bloomRadius: { value: 0.25, min: 0, max: 1, step: 0.05, label: "rayon" },
    }),
    "Vignette": folder({
      vignetteDarkness: { value: 0.5, min: 0, max: 1, step: 0.05, label: "intensité" },
      vignetteOffset: { value: 0.35, min: 0, max: 1, step: 0.05, label: "rayon clair" },
    }),
    "Renard": folder({
      walkSpeed: { value: 2.5, min: 0.5, max: 8, step: 0.1, label: "marche" },
      runSpeed: { value: 6, min: 1, max: 15, step: 0.5, label: "galop" },
      turnSpeed: { value: 2.5, min: 0.5, max: 8, step: 0.1, label: "rotation" },
      camDistance: { value: 6, min: 2, max: 20, step: 0.5, label: "recul caméra" },
      camHeight: { value: 3, min: 0.5, max: 12, step: 0.5, label: "hauteur caméra" },
    }),
    "Soleil": folder({
      startHour: { value: 12, min: 0, max: 24, step: 0.1, label: "heure" },
      cycleMinutes: { value: 2, min: 0.5, max: 60, step: 0.5, label: "cycle (min)" },
      paused: { value: false, label: "figer le temps" },
      sunIntensity: { value: 1.6, min: 0, max: 5, step: 0.1, label: "intensité" },
      dayAmbient: { value: 0.6, min: 0, max: 2, step: 0.05, label: "ambiante de jour" },
    }),
    "Physique": folder({
      gravity: { value: -9.81, min: -30, max: 0, step: 0.1, label: "gravité" },
      debugPhysics: { value: false, label: "voir les colliders" },
    }),
  });

  return (
    <KeyboardControls map={KEYBOARD_MAP}>
      <div style={{ width: "100vw", height: "100vh" }}>
        <Leva collapsed={false} />

        {/* Aide-mémoire des commandes */}
        <div
          style={{
            position: "absolute",
            bottom: 16,
            left: 16,
            zIndex: 1,
            padding: "10px 14px",
            borderRadius: 8,
            background: "rgba(0,0,0,0.45)",
            color: "white",
            font: "13px/1.5 system-ui, sans-serif",
            pointerEvents: "none",
          }}
        >
          <b>ZQSD</b> ou <b>flèches</b> — se déplacer
          <br />
          <b>Maj</b> — galoper
          {/* Note qui s'efface à la tombée de la nuit */}
          <div
            ref={note}
            style={{
              marginTop: 8,
              paddingTop: 8,
              borderTop: "1px solid rgba(255,255,255,0.25)",
              fontSize: 12,
              fontStyle: "italic",
            }}
          >
            Attends la tombée de la nuit pour voir les lampes s'allumer
          </div>
        </div>

        <Canvas shadows camera={{ position: [0, 4, 19], fov: 50 }}>
          {/* Ciel et brume ; sunPosition est écrit par SunCycle */}
          <color attach="background" args={["#4ea6e6"]} />
          <Sky ref={sky} turbidity={6} rayleigh={1.2} />
          <fog ref={fog} attach="fog" args={[fogColor, fogNear, fogFar]} />

          {/* Lumière d'ambiance, atténuée la nuit */}
          <ambientLight ref={ambient} />
          {/* Le soleil, seule source d'ombres ; piloté par SunCycle */}
          <directionalLight
            ref={sunLight}
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-camera-left={-SHADOW_HALF}
            shadow-camera-right={SHADOW_HALF}
            shadow-camera-top={SHADOW_HALF}
            shadow-camera-bottom={-SHADOW_HALF}
            shadow-camera-far={SUN_DISTANCE + SHADOW_HALF + 15}
            // supprime les rayures d'auto-ombrage
            shadow-normalBias={0.02}
          />

          <SunCycle
            light={sunLight}
            sky={sky}
            ambient={ambient}
            fog={fog}
            fogColor={fogColor}
            night={night}
            note={note}
            startHour={startHour}
            speed={paused ? 0 : 24 / (cycleMinutes * 60)}
            intensity={sunIntensity}
            dayAmbient={dayAmbient}
          />

          {/* Pétales de cerisier */}
          <Sparkles
            count={petalCount}
            scale={[20, 10, 20]}
            position={[0, 4, 0]}
            size={petalSize}
            speed={petalSpeed}
            color={petalColor}
          />

          <Suspense fallback={<Loader />}>
            {/* Monde physique ; debug affiche les colliders en fil de fer */}
            <Physics gravity={[0, gravity, 0]} debug={debugPhysics}>
              <Floor />
              <Walls />

              {/* Pagode au fond, torii à l'entrée */}
              <StaticModel url={PAGODA_URL} position={[0, 0, -12]} scale={0.5} />
              <StaticModel
                url={TORII_URL}
                position={[0, 2.2, 9]}
                rotation={[0, TORII_Y_ROTATION, 0]}
                scale={10}
              />

              {/* Cerisiers bordant l'allée */}
              <StaticModel url={TREE_URL} position={[-10, 0, -4]} scale={0.06} />
              <StaticModel url={TREE_URL} position={[10, 0, -4]} scale={0.06} />
              <StaticModel url={TREE_URL} position={[-11, 0, 5]} scale={0.05} />
              <StaticModel url={TREE_URL} position={[11, 0, 5]} scale={0.05} />

              {/* Renards statues */}
              <StaticModel url={FOX_URL} position={[-3, 0, 0]} scale={1.57} colliders="hull" />
              <StaticModel url={FOX_URL} position={[0, 0, -2]} scale={1.57} colliders="hull" />
              <StaticModel url={FOX_URL} position={[3, 0, 0]} scale={1.57} colliders="hull" />

              {LAMP_POSITIONS.map((p, i) => (
                <PhysicalLamp
                  key={i}
                  position={p}
                  scale={lampScale}
                  color={lampColor}
                  glow={lampGlow}
                  lightIntensity={lampLight}
                  flicker={lampFlicker}
                  night={night}
                />
              ))}

              {/* Le renard pilotable, lâché en l'air devant le torii */}
              <Fox
                position={[0, 2, 13]}
                walkSpeed={walkSpeed}
                runSpeed={runSpeed}
                turnSpeed={turnSpeed}
                onMove={(p, heading) => {
                  fox.current.p = p;
                  fox.current.heading = heading;
                }}
              />
            </Physics>
          </Suspense>

          <EffectComposer multisampling={4}>
            {/* Lueur des vitres de lanterne, au-dessus du seuil de luminance */}
            <Bloom
              mipmapBlur
              intensity={bloomIntensity}
              luminanceThreshold={bloomThreshold}
              luminanceSmoothing={0.2}
              radius={bloomRadius}
            />
            {/* Assombrissement des bords de l'image */}
            <Vignette darkness={vignetteDarkness} offset={vignetteOffset} />
          </EffectComposer>

          <FollowCamera target={fox} distance={camDistance} height={camHeight} />
        </Canvas>
      </div>
    </KeyboardControls>
  );
}
