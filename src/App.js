import React, { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF, Html, Sky, Sparkles } from "@react-three/drei";
import Model from "./Model";
import "./App.css";

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
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Canvas camera={{ position: [0, 3, 8], fov: 50 }}>
        {/* Fond bleu ciel + ciel réaliste (le Sky recouvre le fond) */}
        <color attach="background" args={["#4ea6e6"]} />
        <Sky sunPosition={[5, 3, 2]} turbidity={6} rayleigh={1.2} />

        {/* Brume légère rosée pour la profondeur, comme les pétales au loin */}
        <fog attach="fog" args={["#f3d6e6", 12, 40]} />

        {/* Lumières */}
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 10, 5]} intensity={1.2} />

        {/* Pétales de cerisier qui flottent dans l'air */}
        <Sparkles
          count={120}
          scale={[20, 10, 20]}
          position={[0, 4, 0]}
          size={6}
          speed={0.4}
          color="#ff9ec4"
        />

        <Suspense fallback={<Loader />}>
          {/* Sol */}
          <Floor />

          {/* --- Décor du sanctuaire --- */}

          {/* Pagode au fond, centrée (scale 0.18 => ~10 de haut) */}
          <Model url={PAGODA_URL} position={[0, 0, -12]} scale={0.18} />

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
        </Suspense>

        <OrbitControls />
      </Canvas>
    </div>
  );
}
