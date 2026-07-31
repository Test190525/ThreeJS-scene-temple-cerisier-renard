import React, { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF, Html, Sky, Sparkles } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import Model from "./Model";
import StoneLamp from "./StoneLamp";
import "./App.css";
import { Leva, useControls, folder } from 'leva'

// Chemins des modèles dans public/model/
// (les espaces dans le nom sont encodés en %20)
const FOX_URL = "/model/Fox.glb";
const PAGODA_URL = "/model/Pagoda.glb";
const TORII_URL = "/model/Torii%20Gate.glb";
const TREE_URL = "/model/Tree.glb";

// Le Torii n'est pas aligné sur les axes dans son fichier .glb : son ouverture
// est orientée à ~47°. On compense pour qu'il soit face à la pagode,
// puis on ajoute un demi-tour (180°) pour que sa façade regarde la pagode.
const TORII_Y_ROTATION = ((47 + 180) * Math.PI) / 180;

// Allée de lanternes : 3 de chaque côté, du torii (z = 9) vers la pagode (z = -12).
// x = ±4.5 pour ne gêner ni les renards (x = ±3) ni les arbres (x = ±10).
const LAMP_POSITIONS = [
  [-4.5, 0, 7],
  [4.5, 0, 7],
  [-4.5, 0, 2],
  [4.5, 0, 2],
  [-4.5, 0, -3],
  [4.5, 0, -3],
];

// Bonus : précharger tous les modèles pour accélérer l'affichage
useGLTF.preload(FOX_URL);
useGLTF.preload(PAGODA_URL);
useGLTF.preload(TORII_URL);
useGLTF.preload(TREE_URL);

// Écran de chargement affiché pendant que les modèles se téléchargent
function Loader() {
  return <Html center>Chargement…</Html>;
}

// Un sol simple : un plan horizontal qui reçoit les modèles
function Floor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <planeGeometry args={[40, 40]} />
      {/* Couleur pierre claire, comme les pavés du sanctuaire */}
      <meshStandardMaterial color="#cfc6bd" />
    </mesh>
  );
}

export default function App() {
  // Panneau Leva : dès qu'un composant monté appelle useControls,
  // le panneau apparaît en haut à droite de la page.
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
  });

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      {/* Le panneau de réglages (collapsed={false} pour l'ouvrir au démarrage) */}
      <Leva collapsed={false} />

      <Canvas camera={{ position: [0, 3, 8], fov: 50 }}>
        {/* Fond bleu ciel + ciel réaliste (le Sky recouvre le fond) */}
        <color attach="background" args={["#4ea6e6"]} />
        <Sky sunPosition={[5, 3, 2]} turbidity={6} rayleigh={1.2} />

        {/* Brume légère rosée pour la profondeur, comme les pétales au loin */}
        <fog attach="fog" args={[fogColor, fogNear, fogFar]} />

        {/* Lumières */}
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 10, 5]} intensity={1.2} />

        {/* Pétales de cerisier qui flottent dans l'air */}
        <Sparkles
          count={petalCount}
          scale={[20, 10, 20]}
          position={[0, 4, 0]}
          size={petalSize}
          speed={petalSpeed}
          color={petalColor}
        />

        <Suspense fallback={<Loader />}>
          {/* Sol */}
          <Floor />

          {/* --- Décor du sanctuaire --- */}

          {/* Pagode au fond, centrée (scale 0.18 => ~10 de haut) */}
          <Model url={PAGODA_URL} position={[0, 0, -12]} scale={0.5} />

          {/* Torii à l'entrée, comme une arche (scale 10 ; y=2.2 pour poser la base au sol)
              Le modèle est stocké tourné d'environ 47° : on le redresse pour que
              l'ouverture soit face à la pagode (on passe dessous suivant l'axe Z) */}
          <Model
            url={TORII_URL}
            position={[0, 2.2, 9]}
            rotation={[0, TORII_Y_ROTATION, 0]}
            scale={10}
          />

          {/* Arbres de cerisier bordant l'allée (scale 0.06 => ~9 de haut) */}
          <Model url={TREE_URL} position={[-10, 0, -4]} scale={0.06} />
          <Model url={TREE_URL} position={[10, 0, -4]} scale={0.06} />
          <Model url={TREE_URL} position={[-11, 0, 5]} scale={0.05} />
          <Model url={TREE_URL} position={[11, 0, 5]} scale={0.05} />

          {/* Renards posés sur l'allée (scale 1.57) */}
          <Model url={FOX_URL} position={[-3, 0, 0]} scale={1.57} />
          <Model url={FOX_URL} position={[0, 0, -2]} scale={1.57} />
          <Model url={FOX_URL} position={[3, 0, 0]} scale={1.57} />

          {/* Allée de 6 lanternes de pierre allumées */}
          {LAMP_POSITIONS.map((p, i) => (
            <StoneLamp
              key={i}
              position={p}
              scale={lampScale}
              color={lampColor}
              glow={lampGlow}
              lightIntensity={lampLight}
              flicker={lampFlicker}
            />
          ))}
        </Suspense>

        {/* Post-processing : seules les vitres des lanternes dépassent le seuil
            de luminance (émissif non tone-mappé > 1), donc elles seules brillent */}
        <EffectComposer multisampling={4}>
          <Bloom
            mipmapBlur
            intensity={bloomIntensity}
            luminanceThreshold={bloomThreshold}
            luminanceSmoothing={0.2}
            radius={bloomRadius}
          />
        </EffectComposer>

        <OrbitControls />
      </Canvas>
    </div>
  );
}
