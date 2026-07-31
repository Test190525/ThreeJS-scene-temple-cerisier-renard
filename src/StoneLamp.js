import React, { useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";

const LAMP_URL = "/model/stone-lamp.glb";

useGLTF.preload(LAMP_URL);

// --- Mesures relevées directement dans le .glb (accesseur POSITION) ---
// Boîte englobante brute : X [-0.455, 0.468] / Y [-2.193, 0.844] / Z [-0.469, 0.424]
// 1) Le pivot n'est PAS à la base : il faut remonter le modèle de 2.193
//    pour que le socle repose exactement sur le sol (y = 0).
const BASE_OFFSET = 2.1929;
// 2) La "chambre à feu" (hi-bukuro) est le prisme carré entre y = -0.06 et y = 0.41,
//    de demi-largeur ~0.244 (coins à r = 0.345). Elle est FERMÉE : aucune ouverture,
//    aucune face intérieure. Une lumière placée dedans serait donc invisible.
//    => on plaque 4 "vitres" émissives juste devant ses 4 faces.
const FIREBOX_Y = 0.175; // centre vertical de la chambre à feu
const FIREBOX_HALF = 0.25; // demi-largeur des faces (0.244 + 0.006 de marge)
const WINDOW_W = 0.3;
const WINDOW_H = 0.34;

// Les 4 faces de la chambre à feu : décalage + rotation Y du plan
const WINDOWS = [
  { position: [0, FIREBOX_Y, FIREBOX_HALF], rotation: [0, 0, 0] },
  { position: [0, FIREBOX_Y, -FIREBOX_HALF], rotation: [0, Math.PI, 0] },
  { position: [FIREBOX_HALF, FIREBOX_Y, 0], rotation: [0, Math.PI / 2, 0] },
  { position: [-FIREBOX_HALF, FIREBOX_Y, 0], rotation: [0, -Math.PI / 2, 0] },
];

/**
 * Une lanterne de pierre allumée.
 * Le .glb ne fournit que la pierre (1 seul mesh, 1 seul matériau, emissive = 0) :
 * la flamme est entièrement ajoutée ici (vitres émissives + pointLight),
 * c'est ce qui permet au Bloom de l'accrocher.
 */
export default function StoneLamp({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 0.6,
  color = "#ffb861",
  glow = 4.5, // > 1 : dépasse le seuil de luminance du Bloom
  lightIntensity = 7.5,
  flicker = false,
}) {
  const { scene } = useGLTF(LAMP_URL);
  // clone mémoïsé : sans useMemo, un nouveau clone serait créé à chaque rendu
  const model = useMemo(() => scene.clone(), [scene]);

  const lightRef = useRef();
  const matRefs = useRef([]);

  // Le pointLight est hors du groupe mis à l'échelle : sinon son `distance`
  // serait lui aussi multiplié par `scale` et l'éclairage changerait avec la taille.
  const flameWorldY = (BASE_OFFSET + FIREBOX_Y) * scale;

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    // deux sinus non harmoniques => vacillement irrégulier, sans random par frame.
    // f = 1 quand le vacillement est coupé, pour revenir exactement aux valeurs
    // des props (sinon on resterait figé sur le dernier facteur appliqué).
    const f = flicker ? 0.85 + 0.15 * Math.sin(t * 7.3) * Math.sin(t * 2.1) : 1;
    if (lightRef.current) lightRef.current.intensity = lightIntensity * f;
    matRefs.current.forEach((m) => {
      if (m) m.emissiveIntensity = glow * f;
    });
  });

  return (
    <group position={position} rotation={rotation}>
      {/* Tout ce qui suit le modèle est exprimé dans ses unités d'origine */}
      <group scale={scale} position={[0, BASE_OFFSET * scale, 0]}>
        <primitive object={model} />

        {/* Les 4 vitres lumineuses collées sur la chambre à feu */}
        {WINDOWS.map((w, i) => (
          <mesh key={i} position={w.position} rotation={w.rotation}>
            <planeGeometry args={[WINDOW_W, WINDOW_H]} />
            <meshStandardMaterial
              ref={(m) => (matRefs.current[i] = m)}
              color="#000000"
              emissive={color}
              emissiveIntensity={glow}
              // indispensable : sans ça le tone mapping ramène la couleur
              // sous 1 et le Bloom ne la détecte plus
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>

      {/* La vraie lumière projetée sur le sol et les modèles voisins */}
      <pointLight
        ref={lightRef}
        position={[0, flameWorldY, 0]}
        color={color}
        intensity={lightIntensity}
        distance={7}
        decay={2}
      />
    </group>
  );
}
